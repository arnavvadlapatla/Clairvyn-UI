import { useEffect, useRef, useState } from 'react';
import DxfParser from 'dxf-parser';

const BASE_URL = 'http://localhost:5000';

// ── Nice-step helpers ────────────────────────────────────────────────────────
const NICE_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];

function niceMeters(rawM) {
    for (const s of NICE_STEPS) if (s >= rawM) return s;
    return NICE_STEPS[NICE_STEPS.length - 1];
}

function fmtLabel(m) {
    return m < 1 ? `${Math.round(m * 100)} cm` : `${m} m`;
}

// ── Scale-bar components ─────────────────────────────────────────────────────
function ScaleBarH({ ppm, style }) {
    const TARGET = 100;
    const nice = niceMeters(TARGET / ppm);
    const barPx = Math.max(4, nice * ppm);
    return (
        <svg style={style} width={barPx + 4} height={28} overflow="visible">
            <rect x={0} y={10} width={barPx + 4} height={10}
                rx={2} fill="rgba(255,255,255,0.82)" />
            <line x1={2} y1={15} x2={barPx + 2} y2={15}
                stroke="#1d4ed8" strokeWidth={2.5} />
            <line x1={2} y1={10} x2={2} y2={20}
                stroke="#1d4ed8" strokeWidth={2} />
            <line x1={barPx + 2} y1={10} x2={barPx + 2} y2={20}
                stroke="#1d4ed8" strokeWidth={2} />
            <text x={(barPx + 4) / 2} y={8} textAnchor="middle"
                fontSize={10} fontFamily="Inter,sans-serif" fontWeight={700}
                fill="#1d4ed8">
                {fmtLabel(nice)}
            </text>
        </svg>
    );
}

function ScaleBarV({ ppm, style }) {
    const TARGET = 100;
    const nice = niceMeters(TARGET / ppm);
    const barPx = Math.max(4, nice * ppm);
    return (
        <svg style={style} width={28} height={barPx + 4} overflow="visible">
            <rect x={10} y={0} width={10} height={barPx + 4}
                rx={2} fill="rgba(255,255,255,0.82)" />
            <line x1={15} y1={2} x2={15} y2={barPx + 2}
                stroke="#1d4ed8" strokeWidth={2.5} />
            <line x1={10} y1={2} x2={20} y2={2}
                stroke="#1d4ed8" strokeWidth={2} />
            <line x1={10} y1={barPx + 2} x2={20} y2={barPx + 2}
                stroke="#1d4ed8" strokeWidth={2} />
            {/* Label rotated sideways */}
            <text
                x={8} y={(barPx + 4) / 2}
                textAnchor="middle"
                fontSize={10} fontFamily="Inter,sans-serif" fontWeight={700}
                fill="#1d4ed8"
                transform={`rotate(-90, 8, ${(barPx + 4) / 2})`}
            >
                {fmtLabel(nice)}
            </text>
        </svg>
    );
}

// ── Entity renderer ──────────────────────────────────────────────────────────
function renderAll(ctx, entities, ox, oy, scale, H) {
    const tx = (x) => x * scale + ox;
    const ty = (y) => H - (y * scale + oy); // flip Y

    ctx.save();
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = Math.max(0.5, 1.2 / scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    console.log([...new Set(parsed.entities.map(e => e.layer))]);
    for (const e of entities) {
     // Skip asset construction geometry
    if (e.layer && e.layer.startsWith("ASSET_")) continue;

    // Skip helper layers
    if (e.layer === "Defpoints" || e.layer === "TEXT") continue;

    ctx.beginPath();

    ctx.beginPath();
        switch (e.type) {
            case 'LINE': {
                const v = e.vertices;
                if (!v || v.length < 2) break;
                ctx.moveTo(tx(v[0].x), ty(v[0].y));
                ctx.lineTo(tx(v[1].x), ty(v[1].y));
                ctx.stroke();
                break;
            }
            case 'LWPOLYLINE':
            case 'POLYLINE': {
                const v = e.vertices || [];
                if (v.length < 2) break;
                ctx.moveTo(tx(v[0].x), ty(v[0].y));
                for (let i = 1; i < v.length; i++) ctx.lineTo(tx(v[i].x), ty(v[i].y));
                if (e.shape) ctx.closePath();
                ctx.stroke();
                break;
            }
            case 'CIRCLE':
                ctx.arc(tx(e.center.x), ty(e.center.y), e.radius * scale, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'ARC': {
                const sa = -(e.startAngle * Math.PI / 180);
                const ea = -(e.endAngle * Math.PI / 180);
                ctx.arc(tx(e.center.x), ty(e.center.y), e.radius * scale, sa, ea, true);
                ctx.stroke();
                break;
            }
            case 'ELLIPSE':
                if (!e.center || !e.majorAxisEndPoint) break;
                ctx.ellipse(
                    tx(e.center.x), ty(e.center.y),
                    Math.hypot(e.majorAxisEndPoint.x, e.majorAxisEndPoint.y) * scale,
                    Math.hypot(e.majorAxisEndPoint.x, e.majorAxisEndPoint.y) * scale * (e.axisRatio || 1),
                    0, 0, Math.PI * 2
                );
                ctx.stroke();
                break;
            default: break;
        }
    }
    ctx.restore();
}

// ── Bounding box helper ──────────────────────────────────────────────────────
function getBBox(entities) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const e of entities) {
        let pts = [];
        if (e.type === 'LINE') pts = e.vertices || [];
        else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') pts = e.vertices || [];
        else if (e.type === 'CIRCLE' || e.type === 'ARC') {
            pts = [{ x: e.center.x + e.radius, y: e.center.y + e.radius },
            { x: e.center.x - e.radius, y: e.center.y - e.radius }];
        }
        for (const p of pts) {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
    }
    if (!isFinite(minX)) return { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    return { minX, maxX, minY, maxY };
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function DXFViewer({ documentId, refreshKey }) {
    const wrapperRef = useRef(null);
    const canvasRef = useRef(null);

    // Persistent view state — NOT React state (avoids render loops)
    const view = useRef({ ox: 0, oy: 0, scale: 1 });
    const drag = useRef({ active: false, sx: 0, sy: 0 });
    const dxfRef = useRef(null);

    // React state only for loading/error/ppm (ppm drives scale-bar render)
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ppm, setPpm] = useState(10);   // pixels per meter

    // ── Redraw ───────────────────────────────────────────────────────────────
    function redraw() {
        const canvas = canvasRef.current;
        if (!canvas || !dxfRef.current) return;
        const W = canvas.width, H = canvas.height;
        if (W === 0 || H === 0) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, W, H);

        const { ox, oy, scale } = view.current;
        renderAll(ctx, dxfRef.current.entities || [], ox, oy, scale, H);

        setPpm(scale); // scale = pixels-per-DXF-unit = pixels-per-meter
    }

    // ── Fit to view ──────────────────────────────────────────────────────────
    function fitToView() {
        const canvas = canvasRef.current;
        if (!canvas || !dxfRef.current) return;
        const W = canvas.width, H = canvas.height;
        if (W === 0 || H === 0) return;

        const bbox = getBBox(dxfRef.current.entities || []);
        const PAD = 40;
        const dxfW = bbox.maxX - bbox.minX || 1;
        const dxfH = bbox.maxY - bbox.minY || 1;
        const s = Math.min((W - PAD * 2) / dxfW, (H - PAD * 2) / dxfH);

        // Centre the content
        const ox = (W - dxfW * s) / 2 - bbox.minX * s;
        const oy = (H - dxfH * s) / 2 - bbox.minY * s;

        view.current = { ox, oy, scale: s };
        setPpm(s);
    }

    // ── Sync canvas pixel dims to wrapper CSS size ───────────────────────────
    function syncSize() {
        const wrapper = wrapperRef.current;
        const canvas = canvasRef.current;
        if (!wrapper || !canvas) return false;
        const W = wrapper.clientWidth;
        const H = wrapper.clientHeight;
        if (W === canvas.width && H === canvas.height) return false;
        canvas.width = W;
        canvas.height = H;
        return true;
    }

    // ── Fetch + parse DXF ────────────────────────────────────────────────────
    useEffect(() => {
        if (!documentId) return;
        setLoading(true);
        setError(null);
        dxfRef.current = null;

        fetch(`${BASE_URL}/get_dxf/${documentId}`, { cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
            .then(text => {
                const parsed = new DxfParser().parseSync(text);
                dxfRef.current = parsed;
                // Ensure canvas is sized before fitting
                syncSize();
                fitToView();
                redraw();
                setLoading(false);
            })
            .catch(err => {
                console.error('[DXFViewer]', err);
                setError('Could not load floor plan.');
                setLoading(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentId, refreshKey]);

    // ── Resize observer ──────────────────────────────────────────────────────
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const ro = new ResizeObserver(() => {
            if (syncSize()) {
                fitToView();
                redraw();
            }
        });
        ro.observe(wrapper);
        return () => ro.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);  // run once; fitToView/redraw read current refs

    // ── Wheel zoom ───────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            const v = view.current;
            v.ox = mx - (mx - v.ox) * factor;
            v.oy = my - (my - v.oy) * factor;
            v.scale *= factor;
            redraw();
        };
        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', onWheel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Pan ──────────────────────────────────────────────────────────────────
    const onMouseDown = (e) => { drag.current = { active: true, sx: e.clientX, sy: e.clientY }; };
    const onMouseMove = (e) => {
        if (!drag.current.active) return;
        view.current.ox += e.clientX - drag.current.sx;
        view.current.oy += e.clientY - drag.current.sy;
        drag.current.sx = e.clientX;
        drag.current.sy = e.clientY;
        redraw();
    };
    const onMouseUp = () => { drag.current.active = false; };

    // ── Render ───────────────────────────────────────────────────────────────
    const ready = !loading && !error;

    return (
        <div
            ref={wrapperRef}
            style={{
                position: 'relative', width: '100%', height: '100%',
                background: '#f8fafc', borderRadius: 12, overflow: 'hidden'
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    display: 'block', width: '100%', height: '100%',
                    cursor: drag.current.active ? 'grabbing' : 'grab'
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
            />

            {/* Loading spinner */}
            {loading && (
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: '#f8fafc', zIndex: 10
                }}>
                    <div style={{ textAlign: 'center', color: '#6b7280' }}>
                        <div style={{
                            width: 36, height: 36, margin: '0 auto 8px',
                            border: '3px solid #dbeafe',
                            borderTop: '3px solid #2563eb',
                            borderRadius: '50%', animation: 'dxf-spin 1s linear infinite'
                        }} />
                        <p style={{ fontSize: 12 }}>Loading floor plan…</p>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                }}>
                    <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>
                </div>
            )}

            {/* ── Horizontal scale bar (bottom-left) ── */}
            {ready && (
                <div style={{
                    position: 'absolute', bottom: 14, left: 14,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-start', gap: 6, pointerEvents: 'none'
                }}>
                    {/* Vertical bar sits above horizontal */}
                    <ScaleBarV ppm={ppm} />
                    {/* Horizontal bar */}
                    <ScaleBarH ppm={ppm} />
                </div>
            )}

            {/* Hint */}
            {ready && (
                <div style={{
                    position: 'absolute', bottom: 8, right: 10,
                    fontSize: 10, color: '#9ca3af', pointerEvents: 'none',
                    fontFamily: 'Inter, sans-serif'
                }}>
                    Scroll to zoom · Drag to pan
                </div>
            )}

            <style>{`@keyframes dxf-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
