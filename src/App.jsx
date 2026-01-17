import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Utensils, X, Star, Navigation, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MOCK_RESTAURANTS = [
  { id: 1, name: "老王拉面", address: "幸福路 123 号", image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80", rating: 4.5 },
  { id: 2, name: "张姐麻辣烫", address: "平安大道 456 号", image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&q=80", rating: 4.2 },
  { id: 3, name: "快乐汉堡", address: "阳光里 789 号", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80", rating: 4.8 },
  { id: 4, name: "四川小吃", address: "美食街 10 号", image: "https://images.unsplash.com/photo-1512058560366-cd242d45547e?w=500&q=80", rating: 4.6 },
  { id: 5, name: "东北大水饺", address: "团结巷 88 号", image: "https://images.unsplash.com/photo-1534422298391-e4f8c170db0a?w=500&q=80", rating: 4.4 },
  { id: 6, name: "精致粤菜", address: "滨江路 1 号", image: "https://images.unsplash.com/photo-1563245332-692543972183?w=500&q=80", rating: 4.7 },
  { id: 7, name: "韩式烤肉", address: "流行中心 B1", image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=500&q=80", rating: 4.5 },
  { id: 8, name: "意式披萨", address: "西餐区 22 号", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80", rating: 4.3 },
  { id: 9, name: "日式居酒屋", address: "和风街 5 号", image: "https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=500&q=80", rating: 4.9 },
  { id: 10, name: "泰式火锅", address: "香料园 303", image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=500&q=80", rating: 4.4 },
];

function App() {
  const [address, setAddress] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const scrollContainerRef = useRef(null);

  const handleSearch = () => {
    if (!address) {
      alert('请输入地址先！');
      return;
    }
    setIsSearching(true);
    // Simulate API call
    setTimeout(() => {
      setRestaurants(MOCK_RESTAURANTS.sort(() => Math.random() - 0.5));
      setIsSearching(false);
    }, 800);
  };

  const handleRandomize = () => {
    if (restaurants.length === 0) {
      alert('先搜索周边的美食吧！');
      return;
    }
    if (isSpinning) return;

    setIsSpinning(true);
    setSelectedRestaurant(null);
    setShowResult(false);

    let duration = 3000;
    let startTime = Date.now();
    let speed = 50;

    const spin = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed < duration) {
        setHighlightedIndex(Math.floor(Math.random() * restaurants.length));
        // Gradually slow down
        const progress = elapsed / duration;
        const currentSpeed = speed + (progress * 200);
        setTimeout(spin, currentSpeed);
      } else {
        // Final selection
        const finalIndex = Math.floor(Math.random() * restaurants.length);
        setHighlightedIndex(finalIndex);
        
        // Flash 3 times (on/off cycles)
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
              placeholder="你在哪儿呢？"
              className="w-full bg-white border-4 border-black rounded-2xl py-4 pl-12 pr-4 text-lg font-bold shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="bg-[#00E676] text-black border-4 border-black rounded-2xl px-6 py-4 text-xl font-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2 hover:bg-[#00c853] whitespace-nowrap"
          >
            {isSearching ? '探测中...' : <Search size={24} />}
          </button>
        </div>
      </div>

      {/* Cards Area */}
      <div className="px-6">
        <div 
          ref={scrollContainerRef}
          className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
        >
          {restaurants.length > 0 ? (
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
                <div className="flex items-center gap-1 text-xs font-bold text-gray-500">
                  <Star size={12} className="fill-yellow-400 text-yellow-400" />
                  {res.rating}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-2 py-12 text-center border-4 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold">
              输入地址，看看周围有啥好吃的
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
                    命中注定
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
                    <div className="text-xl font-black">{selectedRestaurant.address}</div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button className="flex-1 bg-black text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
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

              {/* Confetti effect placeholder or just some stars */}
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
