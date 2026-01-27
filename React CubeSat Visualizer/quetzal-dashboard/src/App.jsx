import React, { useState, useEffect, useMemo, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { _GlobeView as GlobeView } from '@deck.gl/core';
import { ScatterplotLayer, BitmapLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Play, Pause, AlertTriangle, Satellite, Zap, FastForward, MapPin } from 'lucide-react'; // Added MapPin icon
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { Matrix4 } from '@math.gl/core';
// import { CubeGeometry } from '@luma.gl/core'; 
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import './App.css'; 

// --- 1. LIGHTING SETUP ---
const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 4.0 });
const pointLight = new PointLight({
  color: [255, 255, 255],
  intensity: 6.0,
  position: [0, 0, 8000000]
});
const lightingEffect = new LightingEffect({ ambientLight, pointLight });

// --- 2. CONFIGURATION ---
const INITIAL_VIEW_STATE = {
  longitude: -80,
  latitude: 43,
  zoom: 1.5,
  minZoom: 0,
  maxZoom: 20
};

// WATERLOO COORDINATES
const WATERLOO_POS = [-80.5204, 43.4643];

export default function App() {
  // --- STATE ---
  const [data, setData] = useState(null);
  const [time, setTime] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(10); 
  
  const lastUpdateRef = useRef(0);
  const animationRef = useRef(null);

  // --- LOAD DATA ---
  useEffect(() => {
    fetch('/mission_data.json')
      .then(resp => resp.json())
      .then(json => {
        setData(json);
      })
      .catch(err => console.error("Could not load data:", err));
  }, []);

  // --- ANIMATION LOOP ---
  useEffect(() => {
    const animate = (now) => {
      if (isPlaying && data) {
        const elapsed = now - lastUpdateRef.current;
        const interval = 1000 / speed; 

        if (elapsed > interval) {
          setTime(t => (t + 1) % data.telemetry.path.length);
          lastUpdateRef.current = now;
        }
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animationRef.current);
    }

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, data, speed]);

  // --- LAYERS ---
  const layers = useMemo(() => {
    if (!data) return [];

    const { path, timestamps, colors, anomalies } = data.telemetry;
    const currentPos = path[time]; 

    return [
      // LAYER 1: 3D EARTH
      new BitmapLayer({
        id: 'earth-texture',
        bounds: [-180, -90, 180, 90],
        image: 'https://unpkg.com/three-globe/example/img/earth-dark.jpg',
      }),

      // LAYER 2: SATELLITE 
      new ScenegraphLayer({
        id: 'satellite-model',
        data: [currentPos], 
        scenegraph: '/satellite.glb', 
        
        // Locked Nadir Pointing (Rotated 90 degrees as requested)
        getOrientation: [0, 90, 90], 
        
        getPosition: d => d,
        sizeScale: 5000, 
        getColor: [255, 255, 255],
        _lighting: undefined, 
        
        transitions: {
          getPosition: 1000 / speed,
          getOrientation: 1000 / speed
        }
      }),

      // LAYER 3: ORBIT TRAIL
      new TripsLayer({
        id: 'orbit-path',
        data: path.map((p, i) => ({
          path: [p], 
          timestamp: timestamps[i],
          color: colors[i]
        })),
        getPath: d => d.path,
        getTimestamps: d => d.timestamp,
        getColor: d => d.color,
        opacity: 0.8,
        widthMinPixels: 3,
        rounded: true,
        trailLength: 600, 
        currentTime: time,
        shadowEnabled: false
      }),

      // LAYER 4: WATERLOO MARKER (NEW)
      new ScatterplotLayer({
        id: 'waterloo-marker',
        data: [{ pos: WATERLOO_POS }],
        getPosition: d => d.pos,
        getFillColor: [255, 255, 0], // Yellow
        getRadius: 50000, 
        radiusMinPixels: 5,
        stroked: true,
        getLineColor: [0, 0, 0],
        getLineWidth: 2000
      }),

      // LAYER 5: DEBUG DOT (Anchor)
      new ScatterplotLayer({
        id: 'debug-anchor',
        data: [currentPos],
        getPosition: d => d,
        getRadius: 10000, 
        getFillColor: [255, 0, 0], 
        radiusMinPixels: 3
      }),

      // LAYER 6: SUN
      new ScatterplotLayer({
        id: 'sun',
        data: [{ position: [0, 0, 0] }], 
        getPosition: [0, 0, 0], 
        getFillColor: [255, 204, 0], 
        getRadius: 1, 
        opacity: 0 
      }),
      
      // LAYER 7: ANOMALIES
      new ScatterplotLayer({
        id: 'anomalies',
        data: (anomalies || []).map(idx => ({ pos: path[idx], idx })),
        getPosition: d => d.pos,
        getFillColor: [255, 50, 50],
        getRadius: 50000, 
        pickable: true,
        onClick: ({ object }) => {
          setTime(object.idx);
          setIsPlaying(false);
        }
      })
    ];
  }, [data, time, speed]);

  if (!data) return <div style={{color: 'white', padding: 20}}>Loading Mission Data...</div>;

  const currentVoltage = data.telemetry.metrics.voltage[time];
  const currentSolar = data.telemetry.metrics.solar[time];
  const isEclipse = currentSolar < 10; 
  const chartData = data.telemetry.metrics.voltage.map((v, i) => ({ index: i, voltage: v }));

  // TELEMETRY HELPERS
  const curPos = data.telemetry.path[time];
  const curOri = data.telemetry.orientation[time];

  return (
    <div className="app-container" style={{ width: '100vw', height: '100vh', background: 'black', position: 'relative', overflow: 'hidden' }}>
      
      {/* 3D MAP */}
      <DeckGL
        views={new GlobeView()}
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        effects={[lightingEffect]}
        parameters={{ cull: true, depthTest: true }}
      />

      {/* OVERLAYS */}
      <div style={{ position: 'absolute', top: 20, left: 20, pointerEvents: 'none' }}>
        <h1 style={{ color: 'white', margin: 0, fontFamily: 'monospace', fontSize: '2rem' }}>QUETZAL-1 OPS</h1>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <Badge color={isEclipse ? '#0066ff' : '#ffd700'} label={isEclipse ? "ECLIPSE" : "SUNLIGHT"} icon={<Satellite size={14}/>} />
          <Badge color={currentVoltage < 3.8 ? 'red' : '#00ff00'} label={`${currentVoltage.toFixed(2)}V`} icon={<Zap size={14}/>} />
        </div>
      </div>

      {/* RIGHT SIDEBAR GROUP */}
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 10, width: 300 }}>
        
        {/* 1. PASS TABLE */}
        <div style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid #333', padding: 15, color: '#ccc', fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: '30vh', overflowY: 'auto' }}>
          <h3 style={{ borderBottom: '1px solid #555', paddingBottom: 5, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} color="yellow"/> WATERLOO PASSES
          </h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#888' }}><th>AOS (T+)</th><th>DUR</th><th>EL</th></tr>
            </thead>
            <tbody>
              {(Array.isArray(data.passes) ? data.passes : (data.passes ? [data.passes] : [])).map((p, i) => (
                <tr 
                  key={i} 
                  onClick={() => { setTime(p.aos_index); setIsPlaying(false); }}
                  style={{ cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.05)' }}
                  className="pass-row"
                >
                  <td>{p.aos_index}m</td>
                  <td>{p.duration_mins}m</td>
                  <td style={{ color: '#00ff00' }}>{p.max_el}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 2. NEW TELEMETRY PANEL */}
        <div style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid #333', padding: 15, color: '#ccc', fontFamily: 'monospace', fontSize: '0.8rem' }}>
          <h3 style={{ borderBottom: '1px solid #555', paddingBottom: 5, marginTop: 0 }}>LIVE TELEMETRY</h3>
          
          <div style={{ marginBottom: 10 }}>
            <strong style={{ color: '#888', display: 'block', fontSize: '0.7rem' }}>POSITION (LLA)</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, color: '#00ff00' }}>
               <span>LON: {curPos[0].toFixed(2)}°</span>
               <span>LAT: {curPos[1].toFixed(2)}°</span>
               <span>ALT: {(curPos[2]/1000).toFixed(0)}km</span>
            </div>
          </div>

          <div>
            <strong style={{ color: '#888', display: 'block', fontSize: '0.7rem' }}>ORIENTATION (Deg)</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, color: '#00ffff' }}>
               {curOri.length === 3 ? (
                 <>
                   <span>X: {curOri[0].toFixed(1)}°</span>
                   <span>Y: {curOri[1].toFixed(1)}°</span>
                   <span>Z: {curOri[2].toFixed(1)}°</span>
                 </>
               ) : (
                 <>
                   <span>Q1: {curOri[0].toFixed(2)}</span>
                   <span>Q2: {curOri[1].toFixed(2)}</span>
                   <span>Q3: {curOri[2].toFixed(2)}</span>
                   <span>Q4: {curOri[3].toFixed(2)}</span>
                 </>
               )}
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM PANEL */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
        background: 'linear-gradient(to top, black, rgba(0,0,0,0.8))', padding: '0 20px', display: 'flex', alignItems: 'center'
      }}>
        <div style={{ marginRight: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              background: 'white', border: 'none', borderRadius: '50%', width: 50, height: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            {isPlaying ? <Pause color="black" /> : <Play color="black" />}
          </button>
          
          {/* SLIDER */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'white', fontSize: '0.7rem', fontFamily: 'monospace' }}>
            <span>SLOW</span>
            <input 
              type="range" 
              min="1" 
              max="200" 
              value={speed} 
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              style={{ width: 80, accentColor: '#00ff00' }}
            />
            <span>FAST</span>
          </div>
        </div>

        {/* Chart */}
        <div style={{ flex: 1, height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="voltColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis hide />
              <YAxis domain={[3.6, 4.2]} hide />
              <Tooltip contentStyle={{ background: '#333', border: 'none', color: 'white' }} />
              <Area type="monotone" dataKey="voltage" stroke="#8884d8" fillOpacity={1} fill="url(#voltColor)" isAnimationActive={false} />
              <ReferenceLine x={time} stroke="red" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const Badge = ({ color, label, icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: color, color: 'black', padding: '2px 8px', borderRadius: 4, fontWeight: 'bold', fontSize: '0.8rem' }}>
    {icon} {label}
  </div>
);


// import React, { useState, useEffect, useMemo, useRef } from 'react';
// import DeckGL from '@deck.gl/react';
// import { _GlobeView as GlobeView } from '@deck.gl/core';
// import { ScatterplotLayer, BitmapLayer } from '@deck.gl/layers';
// import { TripsLayer } from '@deck.gl/geo-layers';
// import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core';
// import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
// import { Play, Pause, AlertTriangle, Satellite, Zap, FastForward } from 'lucide-react'; // Added FastForward icon
// import { ScenegraphLayer } from '@deck.gl/mesh-layers';
// import { Matrix4 } from '@math.gl/core';
// // import { CubeGeometry } from '@luma.gl/core'; // Add this import at the top
// import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
// import './App.css'; 

// // --- 1. LIGHTING SETUP ---
// const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 4.0 });
// const pointLight = new PointLight({
//   color: [255, 255, 255],
//   intensity: 6.0,
//   position: [0, 0, 8000000]
// });
// const lightingEffect = new LightingEffect({ ambientLight, pointLight });

// // --- 2. CONFIGURATION ---
// const INITIAL_VIEW_STATE = {
//   longitude: -80,
//   latitude: 43,
//   zoom: 1.5,
//   minZoom: 0,
//   maxZoom: 20
// };

// export default function App() {
//   // --- STATE ---
//   const [data, setData] = useState(null);
//   const [time, setTime] = useState(0); 
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [speed, setSpeed] = useState(10); // Default: 10 steps per second
  
//   // Ref for controlling animation speed
//   const lastUpdateRef = useRef(0);
//   const animationRef = useRef(null);

//   // --- LOAD DATA ---
//   useEffect(() => {
//     fetch('/mission_data.json')
//       .then(resp => resp.json())
//       .then(json => {
//         setData(json);
//       })
//       .catch(err => console.error("Could not load data:", err));
//   }, []);

//   // --- IMPROVED ANIMATION LOOP ---
//   // This version respects the "Speed" slider
//   useEffect(() => {
//     const animate = (now) => {
//       if (isPlaying && data) {
//         // Calculate time since last update
//         const elapsed = now - lastUpdateRef.current;
//         const interval = 1000 / speed; // Convert speed (fps) to interval (ms)

//         if (elapsed > interval) {
//           setTime(t => (t + 1) % data.telemetry.path.length);
//           lastUpdateRef.current = now;
//         }
//         animationRef.current = requestAnimationFrame(animate);
//       }
//     };

//     if (isPlaying) {
//       animationRef.current = requestAnimationFrame(animate);
//     } else {
//       cancelAnimationFrame(animationRef.current);
//     }

//     return () => cancelAnimationFrame(animationRef.current);
//   }, [isPlaying, data, speed]);

  
//   // --- LAYERS ---
//   const layers = useMemo(() => {
//     if (!data) return [];

//     const { path, timestamps, colors, anomalies } = data.telemetry;
//     const currentPos = path[time]; // [Longitude, Latitude, Altitude]

//     return [
//       // LAYER 1: 3D EARTH
//       new BitmapLayer({
//         id: 'earth-texture',
//         bounds: [-180, -90, 180, 90],
//         image: 'https://unpkg.com/three-globe/example/img/earth-dark.jpg',
//       }),

//       // LAYER 2: SATELLITE (Locked Nadir Pointing)
//       new ScenegraphLayer({
//         id: 'satellite-model',
//         data: [currentPos], 
//         scenegraph: '/satellite.glb', 
        
//         // --- ORIENTATION FIX ---
//         // 1. Ignore MATLAB data (which is Inertial)
//         // 2. [Pitch, Yaw, Roll] in degrees
//         // Try [180, 0, 0] to flip Z-axis from Up to Down.
//         // If it's sideways, try [180, 90, 0] or [0, 180, 0].
//         getOrientation: [0, 90, 90], 
        
//         // REMOVE modelMatrix (Let getOrientation handle it)
//         // modelMatrix: ...
        
//         // Positioning
//         getPosition: d => d,
        
//         // Visibility
//         sizeScale: 5000, 
//         getColor: [255, 255, 255],
//         _lighting: undefined, // Keep flat shading for visibility
        
//         // Smooth transitions
//         transitions: {
//           getPosition: 500 / speed,
//           getOrientation: 500 / speed
//         }
//       }),

//       // LAYER 3: ORBIT TRAIL
//       new TripsLayer({
//         id: 'orbit-path',
//         data: path.map((p, i) => ({
//           path: [p], 
//           timestamp: timestamps[i],
//           color: colors[i]
//         })),
//         getPath: d => d.path,
//         getTimestamps: d => d.timestamp,
//         getColor: d => d.color,
//         opacity: 0.8,
//         widthMinPixels: 3,
//         rounded: true,
//         trailLength: 600, 
//         currentTime: time,
//         shadowEnabled: false
//       }),

//       // LAYER 4: DEBUG DOT (The "Anchor Point")
//       // This proves exactly where the satellite SHOULD be.
//       new ScatterplotLayer({
//         id: 'debug-anchor',
//         data: [currentPos],
//         getPosition: d => d,
//         getRadius: 10000, // 10km radius (Smaller than the satellite model)
//         getFillColor: [255, 0, 0], // Red
//         radiusMinPixels: 3
//       }),

//       // LAYER 5: SUN
//       new ScatterplotLayer({
//         id: 'sun',
//         data: [{ position: [0, 0, 0] }], 
//         getPosition: [0, 0, 0], 
//         getFillColor: [255, 204, 0], 
//         getRadius: 1, 
//         opacity: 0 
//       }),
      
//       // LAYER 6: ANOMALIES
//       new ScatterplotLayer({
//         id: 'anomalies',
//         data: (anomalies || []).map(idx => ({ pos: path[idx], idx })),
//         getPosition: d => d.pos,
//         getFillColor: [255, 50, 50],
//         getRadius: 50000, 
//         pickable: true,
//         onClick: ({ object }) => {
//           setTime(object.idx);
//           setIsPlaying(false);
//         }
//       })
//     ];
//   }, [data, time, speed]);



//   if (!data) return <div style={{color: 'white', padding: 20}}>Loading Mission Data...</div>;

//   const currentVoltage = data.telemetry.metrics.voltage[time];
//   const currentSolar = data.telemetry.metrics.solar[time];
//   const isEclipse = currentSolar < 10; 
//   const chartData = data.telemetry.metrics.voltage.map((v, i) => ({ index: i, voltage: v }));

//   return (
//     <div className="app-container" style={{ width: '100vw', height: '100vh', background: 'black', position: 'relative', overflow: 'hidden' }}>
      
//       {/* 3D MAP */}
//       <DeckGL
//         views={new GlobeView()}
//         initialViewState={INITIAL_VIEW_STATE}
//         controller={true}
//         layers={layers}
//         effects={[lightingEffect]}
//         parameters={{ cull: true, depthTest: true }}
//       />

//       {/* OVERLAYS */}
//       <div style={{ position: 'absolute', top: 20, left: 20, pointerEvents: 'none' }}>
//         <h1 style={{ color: 'white', margin: 0, fontFamily: 'monospace', fontSize: '2rem' }}>QUETZAL-1 OPS</h1>
//         <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
//           <Badge color={isEclipse ? '#0066ff' : '#ffd700'} label={isEclipse ? "ECLIPSE" : "SUNLIGHT"} icon={<Satellite size={14}/>} />
//           <Badge color={currentVoltage < 3.8 ? 'red' : '#00ff00'} label={`${currentVoltage.toFixed(2)}V`} icon={<Zap size={14}/>} />
//         </div>
//       </div>

//       {/* RIGHT SIDEBAR */}
//       <div style={{
//         position: 'absolute', top: 20, right: 20, width: 300, 
//         background: 'rgba(0,0,0,0.8)', border: '1px solid #333', padding: 15,
//         color: '#ccc', fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: '50vh', overflowY: 'auto'
//       }}>
//         <h3 style={{ borderBottom: '1px solid #555', paddingBottom: 5, marginTop: 0 }}>WATERLOO PASSES</h3>
//         <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
//           <thead>
//             <tr style={{ color: '#888' }}><th>AOS (T+)</th><th>DUR</th><th>EL</th></tr>
//           </thead>
//           <tbody>
//             {(Array.isArray(data.passes) ? data.passes : (data.passes ? [data.passes] : [])).map((p, i) => (
//               <tr 
//                 key={i} 
//                 onClick={() => { setTime(p.aos_index); setIsPlaying(false); }}
//                 style={{ cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.05)' }}
//                 className="pass-row"
//               >
//                 <td>{p.aos_index}m</td>
//                 <td>{p.duration_mins}m</td>
//                 <td style={{ color: '#00ff00' }}>{p.max_el}°</td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>

//       {/* BOTTOM PANEL - UPDATED WITH SLIDER */}
//       <div style={{
//         position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
//         background: 'linear-gradient(to top, black, rgba(0,0,0,0.8))', padding: '0 20px', display: 'flex', alignItems: 'center'
//       }}>
//         {/* Playback Controls */}
//         <div style={{ marginRight: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
//           <button 
//             onClick={() => setIsPlaying(!isPlaying)}
//             style={{
//               background: 'white', border: 'none', borderRadius: '50%', width: 50, height: 50,
//               display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
//             }}
//           >
//             {isPlaying ? <Pause color="black" /> : <Play color="black" />}
//           </button>
          
//           {/* SPEED SLIDER */}
//           <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'white', fontSize: '0.7rem', fontFamily: 'monospace' }}>
//             <span>SLOW</span>
//             <input 
//               type="range" 
//               min="1" 
//               max="60" 
//               value={speed} 
//               onChange={(e) => setSpeed(parseInt(e.target.value))}
//               style={{ width: 80, accentColor: '#00ff00' }}
//             />
//             <span>FAST</span>
//           </div>
//         </div>

//         {/* Chart */}
//         <div style={{ flex: 1, height: '100%' }}>
//           <ResponsiveContainer width="100%" height="100%">
//             <AreaChart data={chartData}>
//               <defs>
//                 <linearGradient id="voltColor" x1="0" y1="0" x2="0" y2="1">
//                   <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
//                   <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
//                 </linearGradient>
//               </defs>
//               <XAxis hide />
//               <YAxis domain={[3.6, 4.2]} hide />
//               <Tooltip contentStyle={{ background: '#333', border: 'none', color: 'white' }} />
//               <Area type="monotone" dataKey="voltage" stroke="#8884d8" fillOpacity={1} fill="url(#voltColor)" isAnimationActive={false} />
//               <ReferenceLine x={time} stroke="red" strokeDasharray="3 3" />
//             </AreaChart>
//           </ResponsiveContainer>
//         </div>
//       </div>
//     </div>
//   );
// }

// const Badge = ({ color, label, icon }) => (
//   <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: color, color: 'black', padding: '2px 8px', borderRadius: 4, fontWeight: 'bold', fontSize: '0.8rem' }}>
//     {icon} {label}
//   </div>
// );