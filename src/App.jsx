import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Utensils, X, Star, Navigation, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- 高德地图配置说明 ---
// 1. 访问高德开放平台 (https://lbs.amap.com/) 注册账号。
// 2. 在控制台创建应用，添加 Key，选择 "Web 端 (JS API)"。
// 3. 获取 Key 和 安全密钥 (jscode)。
const AMAP_CONFIG = {
  key: '9b88afd029eeb91495ebb1a0f7b810f2', // 在此输入你的 Key
  securityJsCode: '423f2aaeba47e4eb81b01a0bab034346', // 在此输入你的安全密钥 (jscode)
};

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function App() {
  const [address, setAddress] = useState(() => localStorage.getItem('last_address') || '');
  const [restaurants, setRestaurants] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const scrollContainerRef = useRef(null);

  // 持久化地址
  useEffect(() => {
    localStorage.setItem('last_address', address);
  }, [address]);

  // 初始化高德地图脚本
  useEffect(() => {
    if (window.AMap) {
      setMapReady(true);
      return;
    }

    // 设置安全密钥 (必须在加载脚本前)
    window._AMapSecurityConfig = {
      securityJsCode: AMAP_CONFIG.securityJsCode,
    };

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_CONFIG.key}&plugin=AMap.Geocoder,AMap.PlaceSearch`;
    script.async = true;
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleSearch = async () => {
    if (!address) {
      setErrorMsg('你在哪儿呢？先输入地址吧！');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    if (!AMAP_CONFIG.key) {
      setErrorMsg('请配置高德地图 API Key！');
      return;
    }
    if (!mapReady) {
      setErrorMsg('地图库还在加载，请稍等一秒...');
      return;
    }

    setIsSearching(true);
    setRestaurants([]);
    setErrorMsg('');

    try {
      const geocoder = new window.AMap.Geocoder();
      
      // 1. 地理编码：地址 -> 经纬度
      geocoder.getLocation(address, (status, result) => {
        if (status === 'complete' && result.geocodes.length > 0) {
          const location = result.geocodes[0].location;
          fetchNearbyRestaurants(location);
        } else {
          setErrorMsg('高德没找到这个地址... 试着写详细点？');
          setIsSearching(false);
        }
      });
    } catch (error) {
      console.error('搜索出错:', error);
      setErrorMsg('发生了一些错误，请检查网络或刷新重试。');
      setIsSearching(false);
    }
  };

  const fetchNearbyRestaurants = (location) => {
    const placeSearch = new window.AMap.PlaceSearch({
      type: '餐饮服务',
      pageSize: 50,
      pageIndex: 1,
      extensions: 'all',
    });

    let allResults = [];

    const searchPage = (pageIndex) => {
      placeSearch.setPageIndex(pageIndex);
      placeSearch.searchNearBy('', location, 500, (status, result) => {
        if (status === 'complete' && result.poiList) {
          const pois = result.poiList.pois.map(poi => ({
            id: poi.id,
            name: poi.name,
            address: poi.address || '暂无详细地址',
            rating: poi.biz_ext?.rating || (Math.random() * 1.5 + 3.5).toFixed(1),
            image: poi.photos?.[0]?.url || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80`,
            distance: poi.distance,
            location: poi.location
          }));

          allResults = [...allResults, ...pois];

          if (result.poiList.pois.length === 50 && allResults.length < 200) {
            searchPage(pageIndex + 1);
          } else {
            setRestaurants(allResults);
            setIsSearching(false);
          }
        } else if (status === 'no_data') {
          if (allResults.length > 0) {
            setRestaurants(allResults);
          } else {
            setErrorMsg('方圆 500 米内好像真没吃的... 你在沙漠吗？');
          }
          setIsSearching(false);
        } else {
          setErrorMsg('获取周边餐厅失败，请重试。');
          setIsSearching(false);
        }
      });
    };

    searchPage(1);
  };

  const handleRandomize = () => {
    if (restaurants.length === 0) {
      setErrorMsg('先搜索周边的美食，才能开始随机挑选哦！');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    if (isSpinning) return;

    setIsSpinning(true);
    setSelectedRestaurant(null);
    setShowResult(false);
    setErrorMsg('');

    let duration = 3000;
    let startTime = Date.now();
    let speed = 50;

    const spin = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed < duration) {
        setHighlightedIndex(Math.floor(Math.random() * restaurants.length));
        const progress = elapsed / duration;
        const currentSpeed = speed + (progress * 200);
        setTimeout(spin, currentSpeed);
      } else {
        const finalIndex = Math.floor(Math.random() * restaurants.length);
        setHighlightedIndex(finalIndex);
        
        let flashCount = 0;
        const flashInterval = setInterval(() => {
          setHighlightedIndex(prev => prev === null ? finalIndex : null);
          flashCount++;
          if (flashCount === 6) {
            clearInterval(flashInterval);
            setHighlightedIndex(finalIndex);
            setIsSpinning(false);
            setSelectedRestaurant(restaurants[finalIndex]);
            setTimeout(() => setShowResult(true), 800);
          }
        }, 150);
      }
    };

    spin();
  };

  return (
    <div className="min-h-screen bg-[#FFFBEB] font-sans pb-24 overflow-x-hidden">
      {/* Header */}
      <header className="pt-10 pb-6 px-6 text-center">
        <motion.h1 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-5xl font-black text-[#FF3D00] mb-2 tracking-tighter italic"
          style={{ textShadow: '4px 4px 0px #FFD600' }}
        >
          等会儿吃啥？
        </motion.h1>
        <p className="text-[#64748b] font-bold text-lg">别纠结了，让命运决定！✨</p>
      </header>

      {/* Search Section */}
      <div className="px-6 mb-8">
        <div className="flex flex-row gap-3">
          <div className="relative group flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FF3D00] group-focus-within:scale-110 transition-transform" size={20} />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="你在哪儿呢？"
              className="w-full bg-white border-4 border-black rounded-2xl py-4 pl-12 pr-4 text-lg font-bold shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="bg-[#00E676] text-black border-4 border-black rounded-2xl px-6 py-4 text-xl font-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2 hover:bg-[#00c853] whitespace-nowrap"
          >
            {isSearching ? <div className="animate-spin rounded-full h-6 w-6 border-4 border-black border-t-transparent" /> : <Search size={24} />}
          </button>
        </div>
        <AnimatePresence>
          {errorMsg && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 text-xs text-red-500 font-bold bg-red-50 p-3 rounded-xl border-4 border-red-200 shadow-[4px_4px_0px_0px_#fee2e2]"
            >
              ⚠️ {errorMsg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Cards Area */}
      <div className="px-6">
        <div 
          ref={scrollContainerRef}
          className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
        >
          {isSearching ? (
            // Skeleton Screen
            [...Array(6)].map((_, i) => (
              <div key={i} className="border-4 border-gray-200 rounded-xl p-3 flex flex-col gap-2 bg-gray-50 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))
          ) : restaurants.length > 0 ? (
            restaurants.map((res, index) => (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  scale: highlightedIndex === index ? 1.05 : 1,
                  backgroundColor: highlightedIndex === index ? '#FFD600' : '#ffffff',
                  borderColor: highlightedIndex === index ? '#FF3D00' : '#000000',
                }}
                className={cn(
                  "border-4 rounded-xl p-3 flex flex-col gap-2 transition-colors",
                  highlightedIndex === index ? "z-10 shadow-[4px_4px_0px_0px_#FF3D00]" : "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                )}
              >
                <div className="font-black text-lg truncate">{res.name}</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs font-bold text-gray-500">
                    <Star size={12} className="fill-yellow-400 text-yellow-400" />
                    {res.rating}
                  </div>
                  <div className="text-[10px] font-black bg-gray-100 px-1 rounded border border-black">
                    {res.distance}m
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-2 py-12 text-center border-4 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold flex flex-col items-center gap-2">
              <Utensils size={48} className="opacity-20" />
              <span>输入地址，看看周围有啥好吃的</span>
            </div>
          )}
        </div>
      </div>

      {/* Random Button */}
      <div className="fixed bottom-8 left-0 right-0 px-6 z-20">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRandomize}
          disabled={isSpinning || restaurants.length === 0}
          className={cn(
            "w-full py-6 rounded-3xl text-3xl font-black border-4 border-black shadow-[0_10px_0_0_#000] active:shadow-none active:translate-y-2 transition-all uppercase tracking-widest",
            isSpinning ? "bg-gray-400 text-gray-200" : "bg-[#FF3D00] text-white"
          )}
        >
          {isSpinning ? '命运之轮转动中...' : '随便吃一个！'}
        </motion.button>
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && selectedRestaurant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 10 }}
              className="bg-white border-8 border-[#FF3D00] rounded-[40px] w-full max-w-md overflow-hidden relative shadow-[0_20px_50px_rgba(255,61,0,0.3)]"
            >
              <button 
                onClick={() => setShowResult(false)}
                className="absolute top-4 right-4 bg-black text-white p-2 rounded-full z-10 hover:scale-110 transition-transform"
              >
                <X size={24} />
              </button>
              
              <div className="h-64 overflow-hidden relative">
                <img 
                  src={selectedRestaurant.image} 
                  alt={selectedRestaurant.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-[#FFD600] inline-block px-4 py-1 rounded-full text-black font-black text-sm mb-2"
                  >
                    命中注定 ({selectedRestaurant.distance}m)
                  </motion.div>
                  <h2 className="text-4xl font-black text-white">{selectedRestaurant.name}</h2>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="bg-[#FFFBEB] p-4 rounded-2xl border-2 border-black">
                    <MapPin className="text-[#FF3D00]" size={28} />
                  </div>
                  <div>
                    <div className="text-gray-500 font-bold text-sm">餐厅地址</div>
                    <div className="text-xl font-black leading-tight">{selectedRestaurant.address}</div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      const url = `https://uri.amap.com/marker?position=${selectedRestaurant.location.lng},${selectedRestaurant.location.lat}&name=${selectedRestaurant.name}`;
                      window.open(url, '_blank');
                    }}
                    className="flex-1 bg-black text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Navigation size={20} /> 导航去吃
                  </button>
                  <button 
                    onClick={() => {
                      setShowResult(false);
                      handleRandomize();
                    }}
                    className="bg-[#FFD600] text-black p-4 rounded-2xl border-4 border-black active:scale-95 transition-transform"
                  >
                    <RotateCcw size={28} />
                  </button>
                </div>
              </div>

              <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      y: [-20, 20],
                      x: [-10, 10],
                      rotate: [0, 360],
                    }}
                    transition={{ 
                      duration: 2 + Math.random(), 
                      repeat: Infinity, 
                      repeatType: "reverse" 
                    }}
                    className="absolute"
                    style={{ 
                      top: `${Math.random() * 100}%`, 
                      left: `${Math.random() * 100}%` 
                    }}
                  >
                    <Star className="text-[#FFD600]" size={12 + Math.random() * 12} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #FFD600;
          border-radius: 10px;
          border: 2px solid #000;
        }
      `}</style>
    </div>
  );
}

export default App;
