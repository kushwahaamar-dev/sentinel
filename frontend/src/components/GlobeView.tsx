import Globe, { GlobeMethods } from "react-globe.gl";
import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";

type SentinelEvent = {
  id: string;
  lat: number;
  lon: number;
  type: "earthquake" | "fire" | "storm";
  label: string;
  txHash?: string;
  rawData?: any;
};

const colorMap: Record<SentinelEvent["type"], string> = {
  earthquake: "#ff3366",
  fire: "#ff9d00",
  storm: "#9b5cff"
};

type Props = {
  events: SentinelEvent[];
  userLocation: { lat: number; lng: number } | null;
  onEventClick: (event: SentinelEvent) => void;
};

// "Sentinel Nodes" for network visualization
const NODES = [
  { id: "miami", lat: 25.7617, lng: -80.1918, name: "MIA-1" },
  { id: "tokyo", lat: 35.6764, lng: 139.6500, name: "TKY-3" },
  { id: "manila", lat: 14.5995, lng: 120.9842, name: "MNL-2" },
  { id: "london", lat: 51.5074, lng: -0.1278, name: "LDN-0" },
  { id: "sf", lat: 37.7749, lng: -122.4194, name: "SFO-9" },
  { id: "sydney", lat: -33.8688, lng: 151.2093, name: "SYD-4" }
];

export function GlobeView({ events, userLocation, onEventClick }: Props) {
  const globeRef = useRef<GlobeMethods | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  // Update dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Generate random arcs for "network traffic" effect
  const arcsData = useMemo(() => {
    const arcs = [];
    for (let i = 0; i < NODES.length; i++) {
      for (let j = i + 1; j < NODES.length; j++) {
        // 40% chance of connection
        if (Math.random() > 0.6) {
          arcs.push({
            startLat: NODES[i].lat,
            startLng: NODES[i].lng,
            endLat: NODES[j].lat,
            endLng: NODES[j].lng,
            color: ["rgba(0, 224, 255, 0.2)", "rgba(155, 92, 255, 0.2)"]
          });
        }
      }
    }
    return arcs;
  }, []);

  useEffect(() => {
    setMounted(true);
    if (!globeRef.current) return;

    // Initial Camera Pos
    globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 1000);

    // Auto-rotate
    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.5;
    globeRef.current.controls().enableZoom = false;

    // Add Starfield
    const scene = globeRef.current.scene();
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 }); // tiny stars
    
    const starCount = 3000;
    const starPositions = new Float32Array(starCount * 3);
    for(let i=0; i<starCount*3; i++) {
        starPositions[i] = (Math.random() - 0.5) * 400; // Spread wide
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

  }, []);

  // Update camera if event happens
  useEffect(() => {
    if (events.length > 0 && globeRef.current) {
      const lastEvent = events[events.length - 1];
      globeRef.current.pointOfView({ lat: lastEvent.lat, lng: lastEvent.lon, altitude: 1.8 }, 2000);
    }
  }, [events]);
  
  // Fly to user location if provided
  useEffect(() => {
      if (userLocation && globeRef.current) {
           globeRef.current.pointOfView({ lat: userLocation.lat, lng: userLocation.lng, altitude: 1.5 }, 2000);
      }
  }, [userLocation]);

  const ringsData = events.map((ev) => ({
    lat: ev.lat,
    lng: ev.lon,
    color: colorMap[ev.type],
    maxR: 8,
    propagationSpeed: 12,
    repeatPeriod: 800
  }));

  const customLayerData = [...events];

  const handleObjectClick = (obj: any) => {
      // Find the event matching this object
      // Since we pass the event object as 'd' to customLayerData, it is 'obj' here?
      // No, react-globe.gl onCustomLayerClick passes (obj, event)
  }

  return (
    <div ref={containerRef} className="glass h-full w-full overflow-hidden rounded-3xl border border-white/5 shadow-2xl relative">
        {!mounted && <div className="absolute inset-0 flex items-center justify-center text-neon animate-pulse">INITIALIZING OPTICS...</div>}
      <Globe
        ref={globeRef}
        height={dimensions.height}
        width={dimensions.width}
        backgroundColor="#00000000" // Transparent to show CSS radial gradient behind if needed, but we used stars
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#00e0ff"
        atmosphereAltitude={0.15}
        
        onLabelClick={(label: any) => {
            if (label.type) { // It's an event label
                onEventClick(label as SentinelEvent);
            }
        }}

        // Network Arcs
        arcsData={arcsData}
        arcColor="color"
        arcDashLength={0.5}
        arcDashGap={4}
        arcDashInitialGap={() => Math.random() * 5}
        arcDashAnimateTime={2000}
        arcStroke={0.5}

        // Sentinel Nodes (Hex)
        labelsData={[
            ...events.map(ev => ({
                ...ev, // Pass full event data for click handler
                lat: ev.lat, 
                lng: ev.lon, 
                text: ev.label, 
                color: colorMap[ev.type],
                size: 1.5,
                dot: 0
            })), 
            ...NODES.map(n => ({
                lat: n.lat,
                lng: n.lng,
                text: n.name,
                color: "rgba(0, 224, 255, 0.6)",
                size: 0.5,
                dot: 0.4
            })),
            ...(userLocation ? [{
                lat: userLocation.lat,
                lng: userLocation.lng,
                text: "HQ (YOU)",
                color: "#00ff88",
                size: 1.2,
                dot: 0.8
            }] : [])
        ]}
        labelColor={(d: any) => d.color}
        labelText={(d: any) => d.text}
        labelSize={(d: any) => d.size}
        labelDotRadius={(d: any) => d.dot}

        // Event Rings
        ringsData={ringsData}
        ringColor={(d: any) => d.color}
        ringMaxRadius={(d: any) => d.maxR}
        ringPropagationSpeed={(d: any) => d.propagationSpeed}
        ringRepeatPeriod={(d: any) => d.repeatPeriod}
        
        // Custom 3D Objects for Events (Vertical Beams)
        customLayerData={customLayerData}
        customThreeObject={(d: any) => {
            // A vertical beam indicating the event
            const geometry = new THREE.CylinderGeometry(0.2, 0.2, 8, 8);
            geometry.translate(0, 4, 0); // Shift up so it sits on surface
            const material = new THREE.MeshBasicMaterial({ 
                color: colorMap[d.type], 
                transparent: true, 
                opacity: 0.6,
                blending: THREE.AdditiveBlending 
            });
            return new THREE.Mesh(geometry, material);
        }}
        customThreeObjectUpdate={(obj, d: any) => {
            Object.assign(obj.position, globeRef.current?.getCoords(d.lat, d.lon, 0.01));
        }}
        // Handle clicks on the beams
        onCustomLayerClick={(obj: any, event: MouseEvent) => {
             // obj is the data item (the event)
             onEventClick(obj as SentinelEvent);
        }}
      />
    </div>
  );
}
