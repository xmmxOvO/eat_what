import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// 自定义 Hook: 用户位置定位
function useUserLocation(mapReady, onLocationSuccess, onLocationError) {
  const [isLocating, setIsLocating] = useState(false);
  const geolocationRef = useRef(null);

  useEffect(() => {
    if (!mapReady || !window.AMap || geolocationRef.current) return;

    // 初始化定位插件
    geolocationRef.current = new window.AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      convert: true,
      showButton: false,
      buttonPosition: 'RB',
      showMarker: false,
      showCircle: false,
      panToLocation: false,
      zoomToAccuracy: false,
    });

    // 请求定位
    setIsLocating(true);
    geolocationRef.current.getCurrentPosition((status, result) => {
      setIsLocating(false);
      
      if (status === 'complete') {
        const location = result.position;
        // 逆地理编码：坐标转地址
        const geocoder = new window.AMap.Geocoder();
        geocoder.getAddress(location, (geocodeStatus, geocodeResult) => {
          if (geocodeStatus === 'complete' && geocodeResult.regeocode) {
            const address = geocodeResult.regeocode.formattedAddress || 
                          geocodeResult.regeocode.addressComponent.province + 
                          geocodeResult.regeocode.addressComponent.city + 
                          geocodeResult.regeocode.addressComponent.district + 
                          geocodeResult.regeocode.addressComponent.street + 
                          geocodeResult.regeocode.addressComponent.streetNumber;
            
            onLocationSuccess({
              location: location,
              address: address,
            });
          } else {
            // 如果逆地理编码失败，使用坐标作为地址
            onLocationSuccess({
              location: location,
              address: `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
            });
          }
        });
      } else {
        // 定位失败，尝试 IP 定位
        try {
          const ipGeolocation = new window.AMap.CitySearch();
          ipGeolocation.getLocalCity((ipStatus, ipResult) => {
            if (ipStatus === 'complete' && ipResult.city && ipResult.bounds) {
              // IP 定位成功，使用城市中心点
              const center = ipResult.bounds.getCenter();
              onLocationSuccess({
                location: center,
                address: ipResult.city + '（IP定位）',
              });
            } else {
              onLocationError(result.message || '定位失败，请手动输入地址');
            }
          });
        } catch (error) {
          onLocationError('定位失败，请手动输入地址');
        }
      }
    });
  }, [mapReady, onLocationSuccess, onLocationError]);

  return { isLocating };
}

function App() {
  const [address, setAddress] = useState(() => localStorage.getItem('last_address') || '');
  const [addressInput, setAddressInput] = useState(() => localStorage.getItem('last_address') || '');
  const [lockedLocation, setLockedLocation] = useState(null);
  const [distance, setDistance] = useState(500);
  const [category, setCategory] = useState('050100|050200|050300|050400');
  const [restaurants, setRestaurants] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  
  // 地址自动完成相关状态
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const [isLocating, setIsLocating] = useState(false);
  const hasAutoLocatedRef = useRef(false);
  const fetchNearbyRestaurantsRef = useRef(null);

  // 定位失败回调
  const handleLocationError = useCallback((message) => {
    setIsLocating(false);
    setInfoMsg('暂时没能感知到你的位置，手动输入地址吧～');
    setTimeout(() => {
      setInfoMsg('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 4000);
  }, []);

  // 定位成功回调 - 使用 ref 来访问 fetchNearbyRestaurants
  const handleLocationSuccess = useCallback(({ location, address }) => {
    setAddressInput(address);
    setAddress(address);
    setLockedLocation(location);
    setIsLocating(false);
    hasAutoLocatedRef.current = true;
    
    // 自动触发搜索
    if (fetchNearbyRestaurantsRef.current) {
      fetchNearbyRestaurantsRef.current(location, distance, category);
    }
  }, [distance, category]);

  const DISTANCE_OPTIONS = [
    { label: '100m', value: 100 },
    { label: '200m', value: 200 },
    { label: '500m', value: 500 },
    { label: '1km', value: 1000 },
    { label: '2km', value: 2000 },
  ];

  const CATEGORY_OPTIONS = [
    { label: '三餐', value: '050100|050200|050300|050400' },
    { label: '甜点', value: '050800' },
    { label: '奶茶', value: '050503' },
  ];

  // 当分类改变时自动触发搜索
  useEffect(() => {
    if (lockedLocation && mapReady) {
      fetchNearbyRestaurants(lockedLocation, distance, category);
    }
  }, [category]);

  // 点击外部关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 持久化地址
  useEffect(() => {
    if (address) {
      localStorage.setItem('last_address', address);
    }
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
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_CONFIG.key}&plugin=AMap.Geocoder,AMap.PlaceSearch,AMap.AutoComplete,AMap.Geolocation`;
    script.async = true;
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // 初始化 AutoComplete
  useEffect(() => {
    if (!mapReady || !window.AMap || autocompleteRef.current) return;

    autocompleteRef.current = new window.AMap.AutoComplete({
      city: '全国',
      citylimit: false,
    });
  }, [mapReady]);

  // 防抖函数
  const debounce = (func, delay) => {
    return (...args) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => func(...args), delay);
    };
  };

  // 处理地址输入变化
  const handleAddressInputChange = (value) => {
    setAddressInput(value);
    setShowSuggestions(true);
    setLockedLocation(null);
    
    if (!value.trim()) {
      setAutocompleteSuggestions([]);
      return;
    }

    if (!autocompleteRef.current) return;

    setIsLoadingSuggestions(true);
    
    // 防抖搜索
    const debouncedSearch = debounce((keyword) => {
      autocompleteRef.current.search(keyword, (status, result) => {
        setIsLoadingSuggestions(false);
        if (status === 'complete' && result.tips) {
          const suggestions = result.tips
            .filter(tip => tip.location && tip.name)
            .map(tip => ({
              name: tip.name,
              district: tip.district || '',
              adcode: tip.adcode,
              location: tip.location,
            }));
          setAutocompleteSuggestions(suggestions);
        } else {
          setAutocompleteSuggestions([]);
        }
      });
    }, 300);

    debouncedSearch(value);
  };

  // 选择地址
  const handleSelectAddress = (suggestion) => {
    setAddressInput(suggestion.name);
    setAddress(suggestion.name);
    setLockedLocation(suggestion.location);
    setShowSuggestions(false);
    setAutocompleteSuggestions([]);
    
    // 自动触发搜索
    if (suggestion.location) {
      fetchNearbyRestaurants(suggestion.location, distance, category);
    }
  };

  const handleSearch = async () => {
    if (!addressInput.trim()) {
      setErrorMsg('你在哪儿呢？先输入地址吧！');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    // 如果已有锁定位置，直接使用
    if (lockedLocation) {
      setIsSearching(true);
      setRestaurants([]);
      setErrorMsg('');
      fetchNearbyRestaurants(lockedLocation, distance, category);
      return;
    }

    // 否则尝试从下拉列表中选择
    if (autocompleteSuggestions.length === 0) {
      setErrorMsg('未找到准确位置，请从下拉列表中选择');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    // 如果用户没有选择，提示从列表中选择
    setErrorMsg('请从下拉列表中选择一个准确的地址');
    setTimeout(() => setErrorMsg(''), 3000);
  };

  const fetchNearbyRestaurants = (location, searchRadius, searchType) => {
    setIsSearching(true);
    setRestaurants([]);
    setErrorMsg('');

    const placeSearch = new window.AMap.PlaceSearch({
      type: searchType, // 使用选中的分类
      pageSize: 50,
      pageIndex: 1,
      extensions: 'all',
    });

    let allResults = [];

    const searchPage = (pageIndex) => {
      placeSearch.setPageIndex(pageIndex);
      placeSearch.searchNearBy('', location, searchRadius, (status, result) => {
        if (status === 'complete' && result.poiList) {
          const pois = result.poiList.pois.map(poi => ({
            id: poi.id,
            name: poi.name,
            address: poi.address || '暂无详细地址',
            rating: poi.biz_ext?.rating || (Math.random() * 1.5 + 3.5).toFixed(1),
            image: poi.photos?.[0]?.url || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80`,
            distance: parseInt(poi.distance),
            location: poi.location
          }));

          allResults = [...allResults, ...pois];

          const totalFound = result.poiList.count;
          // 2km 模式下，为了突破高德 200 条限制，我们设置更高的获取上限
          const maxAllowed = searchRadius >= 2000 ? 2000 : (searchRadius >= 1000 ? 1000 : 300);

          if (allResults.length < totalFound && allResults.length < maxAllowed) {
            searchPage(pageIndex + 1);
          } else {
            const sortedResults = allResults.sort((a, b) => a.distance - b.distance);
            setRestaurants(sortedResults);
            setIsSearching(false);
          }
        } else if (status === 'no_data') {
          if (allResults.length > 0) {
            const sortedResults = allResults.sort((a, b) => a.distance - b.distance);
            setRestaurants(sortedResults);
          } else {
            setErrorMsg(`方圆 ${searchRadius >= 1000 ? (searchRadius/1000)+'km' : searchRadius+'米'} 内好像真没发现这类吃的...`);
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

  // 将 fetchNearbyRestaurants 存储到 ref
  useEffect(() => {
    fetchNearbyRestaurantsRef.current = fetchNearbyRestaurants;
  }, [distance, category]);

  // 使用定位 Hook
  const { isLocating: isLocatingFromHook } = useUserLocation(
    mapReady && !hasAutoLocatedRef.current,
    handleLocationSuccess,
    handleLocationError
  );

  useEffect(() => {
    setIsLocating(isLocatingFromHook);
  }, [isLocatingFromHook]);

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
      <div className="px-6 mb-6">
        <div className="flex flex-row gap-2 mb-4">
          <div className="relative group flex-1" ref={inputRef}>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FF3D00] group-focus-within:scale-110 transition-transform z-10" size={16} />
            <input
              type="text"
              value={isLocating ? '正在获取当前位置...' : addressInput}
              onChange={(e) => {
                if (!isLocating) {
                  handleAddressInputChange(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (isLocating) return;
                if (e.key === 'Enter') {
                  handleSearch();
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false);
                }
              }}
              onFocus={() => {
                if (!isLocating && autocompleteSuggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              placeholder="你在哪儿呢？"
              disabled={isLocating}
              className="w-full bg-white border-2 border-black rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            />
            {isLocating && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#FF3D00] border-t-transparent"></div>
              </div>
            )}
            
            {/* 地址下拉提示列表 */}
            <AnimatePresence>
              {showSuggestions && (autocompleteSuggestions.length > 0 || isLoadingSuggestions) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-60 overflow-y-auto z-50 custom-scrollbar"
                >
                  {isLoadingSuggestions ? (
                    <div className="p-3 text-center text-xs font-bold text-gray-400">正在搜索...</div>
                  ) : autocompleteSuggestions.length > 0 ? (
                    autocompleteSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectAddress(suggestion)}
                        className="w-full text-left px-4 py-3 hover:bg-[#FFFBEB] border-b-2 border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-black text-sm text-black">{suggestion.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{suggestion.district}</div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs font-bold text-gray-400">未找到相关地址</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Distance Select - Integrated into search row */}
          <div className="relative">
            <select
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              className="h-full bg-[#FFD600] border-2 border-black rounded-xl px-2 pr-6 text-[10px] font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none appearance-none cursor-pointer"
            >
              {DISTANCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none font-black text-[8px]">▼</div>
          </div>

          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="bg-[#00E676] text-black border-2 border-black rounded-xl px-4 py-2.5 text-base font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 hover:bg-[#00c853] whitespace-nowrap"
          >
            {isSearching ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent" /> : <Search size={20} />}
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex flex-row gap-1.5 overflow-x-auto pt-4 pb-2 pl-2 no-scrollbar">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setCategory(opt.value);
                setSelectedRestaurant(null);
                setShowResult(false);
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-black border-2 transition-all whitespace-nowrap",
                category === opt.value 
                  ? "bg-[#FFD600] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]" 
                  : "bg-white border-gray-200 text-gray-400"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 诊断信息面板 */}
        {restaurants.length > 0 && !isSearching && (
          <div className="mt-2 text-[9px] text-gray-400 font-bold flex justify-between px-1 animate-fadeIn">
            <span>已找到周边 {restaurants.length} 家 {CATEGORY_OPTIONS.find(o => o.value === category)?.label}</span>
            <span>覆盖范围: {restaurants[restaurants.length - 1].distance}m</span>
          </div>
        )}

        <AnimatePresence>
          {errorMsg && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded-lg border-2 border-red-200 shadow-[2px_2px_0px_0px_#fee2e2]"
            >
              ⚠️ {errorMsg}
            </motion.p>
          )}
          {infoMsg && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 text-[10px] text-blue-600 font-bold bg-blue-50 p-2 rounded-lg border-2 border-blue-200 shadow-[2px_2px_0px_0px_#dbeafe]"
            >
              💡 {infoMsg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Cards Area */}
      <div className="px-6">
        <div 
          ref={scrollContainerRef}
          className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
        >
          {isSearching ? (
            // Skeleton Screen
            [...Array(9)].map((_, i) => (
              <div key={i} className="border-4 border-gray-200 rounded-xl p-2 flex flex-col gap-2 bg-gray-50 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
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
                  "border-2 rounded-xl p-2 flex flex-col gap-1 transition-colors",
                  highlightedIndex === index ? "z-10 shadow-[3px_3px_0px_0px_#FF3D00]" : "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                )}
              >
                <div className="font-black text-[10px] leading-tight truncate">{res.name}</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5 text-[8px] font-bold text-gray-500">
                    <Star size={8} className="fill-yellow-400 text-yellow-400" />
                    {res.rating}
                  </div>
                  <div className="text-[8px] font-black bg-gray-100 px-0.5 rounded border border-black">
                    {res.distance}m
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-3 py-12 text-center border-4 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold flex flex-col items-center gap-2">
              <Utensils size={48} className="opacity-20" />
              <span>输入地址，看看周围有啥好吃的</span>
            </div>
          )}
        </div>
      </div>

      {/* Random Button */}
      <div className="fixed bottom-6 left-0 right-0 px-6 z-20">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRandomize}
          disabled={isSpinning || restaurants.length === 0}
          className={cn(
            "w-full py-4 rounded-2xl text-xl font-black border-2 border-black shadow-[0_6px_0_0_#000] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest",
            isSpinning ? "bg-gray-400 text-gray-200" : "bg-[#FF3D00] text-white"
          )}
        >
          {isSpinning ? '正在挑选...' : '随便吃一个！'}
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
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
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
