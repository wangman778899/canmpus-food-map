import { useState, useEffect, useRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Coffee, Soup, Flame, Cookie, UtensilsCrossed, Utensils, Salad, Store } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [39.9, 116.4]
const DEFAULT_ZOOM = 15

// 餐厅类型 → Lucide 图标组件（用于地图 Pin 中心）
const TYPE_LUCIDE_ICON = {
  咖啡: Coffee,
  粉面: Soup,
  麻辣烫: Flame,
  小吃: Cookie,
  快餐: UtensilsCrossed,
  食堂: Utensils,
  轻食: Salad,
  米饭: UtensilsCrossed,
  默认: Store,
}

// 客流状态 → Pin 背景色（与 BUSY_LEVEL_CONFIG 一致）
const PIN_COLORS = {
  空闲: '#10b981', // emerald-500
  适中: '#f59e0b', // amber-500
  拥挤: '#ef4444', // red-500
}

/** 根据餐厅类型与客流创建自定义 Pin 标记（L.divIcon）：水滴形背景 + 中心 Lucide 图标 */
function createPinIcon(type, busyLevel) {
  const IconComponent = TYPE_LUCIDE_ICON[type] ?? TYPE_LUCIDE_ICON.默认
  const color = PIN_COLORS[busyLevel] ?? PIN_COLORS.适中
  const iconSvg = renderToStaticMarkup(
    <IconComponent size={14} color="white" strokeWidth={2.5} />
  )
  const html = `
    <div class="pin-outer" style="
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      transform-origin: 16px 32px;
    ">
      <div class="pin-shape" style="
        width: 32px; height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${color};
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        display: flex; align-items: center; justify-content: center;
      ">
        <div class="pin-icon-inner" style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
          ${iconSvg}
        </div>
      </div>
    </div>
  `
  return L.divIcon({
    className: 'pin-marker',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
}

const BUSY_LEVELS = ['空闲', '适中', '拥挤']

const BUSY_LEVEL_CONFIG = {
  空闲: { color: 'bg-emerald-500', label: '空闲', textColor: 'text-emerald-700' },
  适中: { color: 'bg-amber-500', label: '适中', textColor: 'text-amber-700' },
  拥挤: { color: 'bg-red-500', label: '拥挤', textColor: 'text-red-600' },
}

/** 卡片标题旁的状态小图标：与地图 Pin 同色 + 白色餐具图标 + 呼吸灯动画 */
function BusyStatusBadge({ busyLevel }) {
  const config = BUSY_LEVEL_CONFIG[busyLevel] ?? BUSY_LEVEL_CONFIG.适中
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${config.color} text-white flex-shrink-0 breathe-light`}
      title={config.label}
      aria-hidden
    >
      <Utensils size={10} strokeWidth={2.5} />
    </span>
  )
}

/** 根据客流等级随机生成合理的排队时间（分钟） */
function randomWaitTimeForLevel(busyLevel) {
  switch (busyLevel) {
    case '空闲':
      return Math.floor(Math.random() * 5) // 0-4
    case '适中':
      return 5 + Math.floor(Math.random() * 16) // 5-20
    case '拥挤':
      return 15 + Math.floor(Math.random() * 21) // 15-35
    default:
      return Math.floor(Math.random() * 30)
  }
}

const RESTAURANTS = [
  { id: 1, name: '后街螺蛳粉', type: '粉面', tags: ['粉面', '辣', '小吃'], price: 18, rating: 4.6, busyLevel: '适中', waitTime: 15, position: [39.901, 116.398] },
  { id: 2, name: '学霸咖啡厅', type: '咖啡', tags: ['咖啡', '轻食', '自习'], price: 32, rating: 4.8, busyLevel: '空闲', waitTime: 0, position: [39.899, 116.402] },
  { id: 3, name: '二食堂麻辣烫', type: '麻辣烫', tags: ['麻辣烫', '食堂', '实惠'], price: 22, rating: 4.2, busyLevel: '拥挤', waitTime: 25, position: [39.902, 116.401] },
  { id: 4, name: '西门烤冷面', type: '小吃', tags: ['小吃', '夜宵', '人气'], price: 12, rating: 4.9, busyLevel: '拥挤', waitTime: 20, position: [39.898, 116.399] },
  { id: 5, name: '北门黄焖鸡', type: '快餐', tags: ['米饭', '快餐', '下饭'], price: 25, rating: 4.5, busyLevel: '适中', waitTime: 10, position: [39.9, 116.404] },
]

const isHighRating = (rating) => rating > 4.5

/** 客流指示灯：空闲绿 / 适中黄 / 拥挤红 */
function BusyLevelDisplay({ busyLevel, waitTime, showWait = true, className = '' }) {
  const config = BUSY_LEVEL_CONFIG[busyLevel] ?? BUSY_LEVEL_CONFIG.适中
  return (
    <div className={`inline-flex items-center gap-2 flex-wrap ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 rounded-full ${config.color} ring-2 ring-white shadow`} aria-hidden />
        <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
      </span>
      {showWait && (
        <span className="text-xs text-gray-600">
          当前排队：约 {waitTime} 分钟
        </span>
      )}
    </div>
  )
}

/** 列表项内展示评分：星标 + 数值，高分用橙色加粗 */
function RatingDisplay({ rating, className = '' }) {
  const high = isHighRating(rating)
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <span className="text-orange-500">⭐</span>
      <span
        className={
          high
            ? 'font-bold text-orange-600'
            : 'text-orange-700'
        }
      >
        {rating}
      </span>
      {high && (
        <span className="ml-1 text-xs font-semibold text-orange-500">高分好评</span>
      )}
    </span>
  )
}

/** 随机生成取号后的前面桌数与预计等待（模拟） */
function randomQueueResult() {
  return { ahead: 3 + Math.floor(Math.random() * 6), wait: 10 + Math.floor(Math.random() * 16) }
}

function App() {
  const [selectedId, setSelectedId] = useState(null)
  const [randomResult, setRandomResult] = useState(null)
  const [sortByRating, setSortByRating] = useState(false)
  const [queueInfo, setQueueInfo] = useState(null) // 当前排队的餐厅信息 { restaurant, ahead, wait }，同时用于控制取号成功弹窗
  const [liveStats, setLiveStats] = useState({}) // { [id]: { busyLevel, waitTime } } 动态客流，每 5 秒更新
  const mapRef = useRef(null)
  const markerRefs = useRef({})
  const openPopupForIdRef = useRef(null)

  // 每 5 秒随机更新每家店的 busyLevel 和 waitTime，模拟实时变化
  useEffect(() => {
    const tick = () => {
      setLiveStats((prev) => {
        const next = {}
        RESTAURANTS.forEach((r) => {
          const busyLevel = BUSY_LEVELS[Math.floor(Math.random() * BUSY_LEVELS.length)]
          next[r.id] = {
            busyLevel,
            waitTime: randomWaitTimeForLevel(busyLevel),
          }
        })
        return next
      })
    }
    tick() // 首次立即执行一次
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [])

  const getBusyLevel = (r) => liveStats[r.id]?.busyLevel ?? r.busyLevel
  const getWaitTime = (r) => liveStats[r.id]?.waitTime ?? r.waitTime

  // 列表展示顺序：按评分排序时为从高到低，否则为原始顺序
  const displayList = sortByRating
    ? [...RESTAURANTS].sort((a, b) => b.rating - a.rating)
    : RESTAURANTS

  // 选中餐厅变化时，地图平滑飞到该餐厅位置（zoom 16），若为随机则飞完后打开 Popup
  useEffect(() => {
    if (!selectedId || !mapRef.current) return
    const restaurant = RESTAURANTS.find((r) => r.id === selectedId)
    if (!restaurant?.position) return
    const needOpenPopup = openPopupForIdRef.current === selectedId
    mapRef.current.flyTo(restaurant.position, 16)
    if (needOpenPopup) {
      openPopupForIdRef.current = null
      const openPopup = () => {
        markerRefs.current[selectedId]?.openPopup()
      }
      mapRef.current.once('moveend', openPopup)
      // 若 flyTo 很快结束，moveend 可能已触发，延迟再试一次
      const t = setTimeout(openPopup, 800)
      return () => clearTimeout(t)
    }
  }, [selectedId])

  const handleRandom = () => {
    const idx = Math.floor(Math.random() * RESTAURANTS.length)
    const picked = RESTAURANTS[idx]
    openPopupForIdRef.current = picked.id
    setSelectedId(picked.id)
    setRandomResult(picked)
  }

  const handleCardClick = (r) => {
    setSelectedId(selectedId === r.id ? null : r.id)
  }

  const handleRemoteQueue = (e, r) => {
    e.stopPropagation()
    e.preventDefault()
    if (queueInfo?.restaurant?.id === r.id) {
      setQueueInfo(null)
      return
    }
    const { ahead, wait } = randomQueueResult()
    setQueueInfo({ restaurant: r, ahead, wait })
  }

  return (
    <div className="min-h-screen bg-orange-50/80 flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white/90 backdrop-blur border-b border-orange-200/60 shadow-sm">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-orange-800 tracking-tight">
            🍜 大学城干饭神器
          </h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧侧边栏 */}
        <aside className="w-80 flex-shrink-0 bg-white/70 backdrop-blur border-r border-orange-200/50 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-orange-100 space-y-2">
            <button
              type="button"
              onClick={handleRandom}
              className="w-full py-3.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold text-base shadow-md shadow-orange-300/40 transition-all"
            >
              🎲 随机吃什么
            </button>
            <button
              type="button"
              onClick={() => setSortByRating((v) => !v)}
              className={`w-full py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                sortByRating
                  ? 'border-orange-400 bg-orange-50 text-orange-800'
                  : 'border-orange-200 bg-white text-orange-700 hover:bg-orange-50/50'
              }`}
            >
              {sortByRating ? '✓ 按评分排序' : '按评分排序'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {displayList.map((r) => (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(r)}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick(r)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedId === r.id
                    ? 'border-orange-500 bg-orange-50 shadow-md ring-2 ring-orange-400/50'
                    : 'border-orange-100 bg-white hover:border-orange-200 hover:bg-orange-50/50'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <BusyStatusBadge busyLevel={getBusyLevel(r)} />
                  <span className="font-semibold text-orange-900">{r.name}</span>
                  <RatingDisplay rating={r.rating} className="text-sm" />
                </div>
                <div className="mt-2">
                  <BusyLevelDisplay busyLevel={getBusyLevel(r)} waitTime={getWaitTime(r)} />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {r.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-sm text-orange-600">
                  人均 ¥{r.price}
                </div>
                <button
                  type="button"
                  onClick={(e) => handleRemoteQueue(e, r)}
                  className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition-all ${
                    queueInfo?.restaurant?.id === r.id
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  {queueInfo?.restaurant?.id === r.id ? '取消排队' : '远程取号'}
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* 右侧地图 */}
        <main className="flex-1 min-w-0 relative">
          <MapContainer
            ref={mapRef}
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            className="w-full h-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {RESTAURANTS.map((r) => (
              <Marker
                key={r.id}
                ref={(el) => {
                  if (el) markerRefs.current[r.id] = el
                }}
                position={r.position}
                icon={createPinIcon(r.type, getBusyLevel(r))}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="font-semibold text-orange-900">{r.name}</div>
                    <div className="mt-1">
                      <BusyLevelDisplay busyLevel={getBusyLevel(r)} waitTime={getWaitTime(r)} showWait />
                    </div>
                    <div className="mt-0.5">
                      <RatingDisplay rating={r.rating} className="text-sm" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 text-sm text-orange-600">人均 ¥{r.price}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </main>
      </div>

      {/* 取号成功弹窗：queueInfo 不为空时显示，固定居中 + 深色半透明遮罩，z-[9999] 避免被 Leaflet 地图挡住 */}
      {queueInfo && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="取号结果"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setQueueInfo(null)}
            onKeyDown={(e) => e.key === 'Escape' && setQueueInfo(null)}
            aria-hidden="true"
          />
          <div className="relative rounded-2xl bg-white px-6 py-5 shadow-xl max-w-sm w-full animate-scale-in">
            <p className="text-center text-lg font-semibold text-gray-900">取号成功！</p>
            <p className="text-center text-orange-800 font-medium mt-2">{queueInfo.restaurant.name}</p>
            <p className="text-center text-gray-600 text-sm mt-1">
              您前面还有 <span className="font-bold text-orange-600">{queueInfo.ahead}</span> 桌，预计等待{' '}
              <span className="font-bold text-orange-600">{queueInfo.wait}</span> 分钟
            </p>
            <button
              type="button"
              onClick={() => setQueueInfo(null)}
              className="mt-4 w-full py-2.5 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600"
            >
              确定
            </button>
          </div>
        </div>
      )}

      {/* 随机结果弹窗：「今天就决定吃 XX 啦！」+ 彩带效果 */}
      {randomResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="随机结果"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setRandomResult(null)}
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-xl ring-2 ring-orange-200 animate-scale-in">
            {/* 简单彩带：几条彩色条 */}
            <div className="absolute -top-1 left-0 right-0 h-2 rounded-t-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-400 opacity-90" />
            <div className="absolute -bottom-1 left-0 right-0 h-2 rounded-b-2xl bg-gradient-to-r from-rose-400 via-orange-500 to-amber-400 opacity-90" />
            <p className="text-center text-lg font-semibold text-orange-900">
              今天就决定吃 <span className="text-orange-600">{randomResult.name}</span> 啦！
            </p>
            <button
              type="button"
              onClick={() => setRandomResult(null)}
              className="rounded-xl bg-orange-500 px-5 py-2 text-white font-medium shadow hover:bg-orange-600"
            >
              好嘞！
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
