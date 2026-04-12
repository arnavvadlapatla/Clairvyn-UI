const chatInner = document.getElementById("chatInner");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");

// ── Chat history persistence ───────────────────────────────────────────────
const CHAT_STORAGE_KEY = "clairvyn_chat_history";
const SERVER_ID_KEY    = "clairvyn_server_instance_id";
let chatHistory = [];
let _isRestoring = false;

function _saveChatHistory() {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory));
}
function _loadChatHistory() {
  try { return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || []; }
  catch { return []; }
}
function _clearChatHistory() {
  chatHistory = [];
  localStorage.removeItem(CHAT_STORAGE_KEY);
  localStorage.removeItem(SERVER_ID_KEY);
}

// ── Scale bar helpers ──────────────────────────────────────────────────────
const SCALE_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
function niceMeters(rawM) {
  for (const s of SCALE_STEPS) if (s >= rawM) return s;
  return SCALE_STEPS[SCALE_STEPS.length - 1];
}
function scaleLabel(m) {
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m} m`;
}

function createScaleBarOverlay(wrapperEl, rendererWidth, rendererHeight) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  Object.assign(svg.style, {
    position: 'absolute', bottom: '0', left: '0',
    width: rendererWidth + 'px', height: rendererHeight + 'px',
    pointerEvents: 'none', overflow: 'visible',
  });

  // Shared style constants
  const BG = 'rgba(10,15,30,0.72)';
  const FG = '#38bdf8';
  const FONT = '700 11px Inter,sans-serif';

  // Horizontal bar group  (bottom-left)
  const hg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const hBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  const hL = document.createElementNS('http://www.w3.org/2000/svg', 'line'); // left tick
  const hR = document.createElementNS('http://www.w3.org/2000/svg', 'line'); // right tick
  const hTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  [hBg, hLine, hL, hR, hTxt].forEach(el => hg.appendChild(el));

  // Vertical bar group (sits above horizontal)
  const vg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const vBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  const vT = document.createElementNS('http://www.w3.org/2000/svg', 'line'); // top tick
  const vB = document.createElementNS('http://www.w3.org/2000/svg', 'line'); // bottom tick
  const vTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  [vBg, vLine, vT, vB, vTxt].forEach(el => vg.appendChild(el));

  svg.appendChild(vg);
  svg.appendChild(hg);
  wrapperEl.appendChild(svg);

  const PAD = 14;  // distance from canvas edge
  const H_Y = rendererHeight - PAD; // baseline Y for horizontal bar

  function update(ppm) {
    const TARGET = 90;
    const nice = niceMeters(TARGET / ppm);
    const barPx = Math.max(6, nice * ppm);

    // ── Horizontal bar ───────────────────────────────────────────────────
    const hX1 = PAD, hX2 = PAD + barPx;
    const hY = H_Y;

    hBg.setAttribute('x', hX1 - 2); hBg.setAttribute('y', hY - 14);
    hBg.setAttribute('width', barPx + 4); hBg.setAttribute('height', 20);
    hBg.setAttribute('rx', 3); hBg.setAttribute('fill', BG);

    hLine.setAttribute('x1', hX1); hLine.setAttribute('y1', hY);
    hLine.setAttribute('x2', hX2); hLine.setAttribute('y2', hY);
    hLine.setAttribute('stroke', FG); hLine.setAttribute('stroke-width', 2.5);

    hL.setAttribute('x1', hX1); hL.setAttribute('y1', hY - 6);
    hL.setAttribute('x2', hX1); hL.setAttribute('y2', hY + 4);
    hL.setAttribute('stroke', FG); hL.setAttribute('stroke-width', 2);

    hR.setAttribute('x1', hX2); hR.setAttribute('y1', hY - 6);
    hR.setAttribute('x2', hX2); hR.setAttribute('y2', hY + 4);
    hR.setAttribute('stroke', FG); hR.setAttribute('stroke-width', 2);

    hTxt.setAttribute('x', (hX1 + hX2) / 2); hTxt.setAttribute('y', hY - 5);
    hTxt.setAttribute('text-anchor', 'middle');
    hTxt.setAttribute('font', FONT); hTxt.setAttribute('fill', FG);
    hTxt.textContent = scaleLabel(nice);

    // ── Vertical bar ─────────────────────────────────────────────────────
    const vY1 = H_Y - 20 - barPx, vY2 = H_Y - 20;
    const vX = PAD + barPx / 2; // centre under horizontal bar

    vBg.setAttribute('x', vX - 14); vBg.setAttribute('y', vY1 - 2);
    vBg.setAttribute('width', 20); vBg.setAttribute('height', barPx + 4);
    vBg.setAttribute('rx', 3); vBg.setAttribute('fill', BG);

    vLine.setAttribute('x1', vX); vLine.setAttribute('y1', vY1);
    vLine.setAttribute('x2', vX); vLine.setAttribute('y2', vY2);
    vLine.setAttribute('stroke', FG); vLine.setAttribute('stroke-width', 2.5);

    vT.setAttribute('x1', vX - 6); vT.setAttribute('y1', vY1);
    vT.setAttribute('x2', vX + 4); vT.setAttribute('y2', vY1);
    vT.setAttribute('stroke', FG); vT.setAttribute('stroke-width', 2);

    vB.setAttribute('x1', vX - 6); vB.setAttribute('y1', vY2);
    vB.setAttribute('x2', vX + 4); vB.setAttribute('y2', vY2);
    vB.setAttribute('stroke', FG); vB.setAttribute('stroke-width', 2);

    vTxt.setAttribute('x', vX - 5); vTxt.setAttribute('y', (vY1 + vY2) / 2);
    vTxt.setAttribute('text-anchor', 'middle');
    vTxt.setAttribute('font', FONT); vTxt.setAttribute('fill', FG);
    vTxt.setAttribute('transform', `rotate(-90 ${vX - 5} ${(vY1 + vY2) / 2})`);
    vTxt.textContent = scaleLabel(nice);
  }

  return { update };
}

function autoGrow() {
  input.style.height = "auto";
  const scrollHeight = input.scrollHeight;
  input.style.height = Math.min(scrollHeight, 160) + "px";
}

input.addEventListener("input", () => {
  autoGrow();
  sendBtn.disabled = input.value.trim() === "";
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendBtn.click();
  }
});

attachBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  fileList.innerHTML = "";
  Array.from(fileInput.files).forEach((file, idx) => {
    const pill = document.createElement("span");
    pill.className = "file-pill";
    pill.innerHTML = `
          ${file.name}
          <span class="file-pill-close" data-idx="${idx}">✕</span>
        `;
    pill.querySelector(".file-pill-close").addEventListener("click", (e) => {
      e.stopPropagation();
      const dt = new DataTransfer();
      Array.from(fileInput.files).forEach((f, i) => {
        if (i !== idx) dt.items.add(f);
      });
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    fileList.appendChild(pill);
  });
});

function addMessage({ role, text, files, documentId, thoughts }) {
  const wrap = document.createElement("div");
  wrap.className = `msg msg-${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "U" : "C";

  const content = document.createElement("div");
  content.className = "msg-content";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  meta.textContent = role === "user" ? "You" : "ClairvynAI";

  content.appendChild(bubble);

  if (thoughts && thoughts.length > 0) {
    const thoughtsWrap = document.createElement("details");
    thoughtsWrap.className = "msg-thoughts";
    thoughtsWrap.innerHTML = `<summary>View Process</summary><ul>` + 
      thoughts.map(t => `<li>${t}</li>`).join('') + `</ul>`;
    content.appendChild(thoughtsWrap);
  }

  if (files && files.length > 0) {
    const filesDiv = document.createElement("div");
    filesDiv.className = "file-items";
    files.forEach((fileName) => {
      const fileItem = document.createElement("span");
      fileItem.className = "file-item";
      fileItem.textContent = "📄 " + fileName;
      filesDiv.appendChild(fileItem);
    });
    content.appendChild(filesDiv);
  }

  content.appendChild(meta);

  // Persist to localStorage (skip during restore to avoid duplicates)
  if (role !== "system" && !_isRestoring) {
    chatHistory.push({ role, text, documentId: documentId || null, thoughts: thoughts || null });
    _saveChatHistory();
  }

  if (role === "ai" && documentId) {
    // Create viewer container
    const viewerContainer = document.createElement("div");
    viewerContainer.className = "dxf-viewer-container";
    viewerContainer.innerHTML = '<div class="viewer-loading">Loading DXF...</div>';
    content.appendChild(viewerContainer);

    // Load and render DXF
    loadDxfViewer(viewerContainer, documentId);

    // Create button container
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.marginTop = "12px";

    // ----------- DXF BUTTON -----------
    const dxfBtn = document.createElement("button");
    dxfBtn.className = "download-btn";
    dxfBtn.textContent = "⬇️ Download DXF";

    dxfBtn.addEventListener("click", async () => {
      try {
        const response = await fetch("/download_file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: documentId }),
        });

        if (!response.ok) throw new Error("Failed to download DXF");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${documentId}.dxf`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
      } catch (error) {
        alert("DXF download failed: " + error.message);
      }
    });

    // ----------- PNG BUTTON -----------
    const pngBtn = document.createElement("button");
    pngBtn.className = "download-btn";
    pngBtn.textContent = "⬇️ Download PNG";

    pngBtn.addEventListener("click", () => {
      const pngUrl = `/get_image/${documentId}?t=${new Date().getTime()}`;
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${documentId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    // Append buttons
    buttonContainer.appendChild(dxfBtn);
    buttonContainer.appendChild(pngBtn);
    content.appendChild(buttonContainer);

  }

  wrap.appendChild(avatar);
  wrap.appendChild(content);
  chatInner.appendChild(wrap);

  setTimeout(() => {
    chatInner.scrollTop = chatInner.scrollHeight;
  }, 0);
}
function addLoadingMessage(initialText = "Processing...") {
  const wrap = document.createElement("div");
  wrap.className = "msg msg-ai";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "C";

  const content = document.createElement("div");
  content.className = "msg-content";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = initialText;

  content.appendChild(bubble);
  wrap.appendChild(avatar);
  wrap.appendChild(content);
  chatInner.appendChild(wrap);

  chatInner.scrollTop = chatInner.scrollHeight;

  return {
    update(text) {
      bubble.textContent = text;
    },
    remove() {
      wrap.remove();
    }
  };
}

// function to simulate progress updates during generation or edit operations.
function simulateProgress(loader, progressType) {
  let steps;
// different steps and timings based on whether its an edit or new generation. 
// steps and delays are designed to feel realistic to the user and mimick the different processes involved. 
// different steps are added based on how the model works according to my observation. 
  if (progressType === "edit") {
    steps = [
      { text: "Understanding request...", delay: 2500 },
      { text: "Applying changes...", delay: 4000 },
      { text: "Updating layout...", delay: 3000 }
    ];
  } else {
  steps = [
    { text: "Understanding request...", delay: 4000 },
    { text: "Generating floor plan...", delay: 10000 },

    { text: "Optimizing layout...", delay: 20000 },
    { text: "Validating design...", delay: 20000 },
    { text: "Fixing layout issues...", delay: 26000 },

    { text: "Applying corrections...", delay: 15000 },
    { text: "Finalizing design...", delay: 25000 },
    { text: "Generating DXF + PNG files...", delay: 6000 }
  ];
}
  let i = 0;
  let stopped = false;

  function runStep() {
    if (stopped) return;

    if (i < steps.length) {
      loader.update(steps[i].text);
      const delay = steps[i].delay + Math.random() * 1000;
      i++;
      setTimeout(runStep, delay);
    } else {
      // stay alive here until backend finishes
      loader.update("Rendering preview...");
      setTimeout(runStep, 3000);
    }
  }

  runStep();

  return () => {
    stopped = true;
  };
}
async function loadDxfViewer(container, documentId) {
  try {
    const fetchUrl = `/get_dxf/${documentId}?t=${new Date().getTime()}`;
    console.log("[DXF Viewer] Fetching:", fetchUrl);
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error("Failed to load DXF file");
    const dxfText = await response.text();

    console.log("[DXF Viewer] DXF content length:", dxfText.length);
    container.innerHTML = "";

    // Parse DXF
    const parser = new window.DxfParser();
    const dxf = parser.parseSync(dxfText);

    // Setup THREE.js
    const width = container.clientWidth || 700;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1a);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Wrap renderer in a relative container so the SVG overlay can overlay it
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { position: 'relative', display: 'inline-block', width: width + 'px', height: height + 'px' });
    wrapper.appendChild(renderer.domElement);
    container.appendChild(wrapper);

    // Create scale bar overlay
    const scaleBar = createScaleBarOverlay(wrapper, width, height);

    // Create Text overlay
    const textOverlay = document.createElement('div');
    Object.assign(textOverlay.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none', overflow: 'hidden'
    });
    wrapper.appendChild(textOverlay);
    const textElements = [];

    // Collect all points for bounding box
    const allPoints = [];

    // Helper: get color from entity
    function getColor(entity) {
      if (entity.color != null && entity.color !== 256) {
        const c = entity.color;
        return new THREE.Color(`hsl(${(c * 37) % 360}, 70%, 60%)`);
      }
      return new THREE.Color(0x38bdf8); // default sky blue
    }

    // Render entities
    if (dxf.entities) {
      dxf.entities.forEach((entity) => {
        let material, geometry, obj;

        switch (entity.type) {
          case "LINE":
            material = new THREE.LineBasicMaterial({ color: getColor(entity) });
            geometry = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(entity.vertices[0].x, entity.vertices[0].y, 0),
              new THREE.Vector3(entity.vertices[1].x, entity.vertices[1].y, 0),
            ]);
            obj = new THREE.Line(geometry, material);
            scene.add(obj);
            entity.vertices.forEach((v) => allPoints.push(v));
            break;

          case "LWPOLYLINE":
          case "POLYLINE":
            if (entity.vertices && entity.vertices.length > 1) {
              material = new THREE.LineBasicMaterial({ color: getColor(entity) });
              const pts = entity.vertices.map(
                (v) => new THREE.Vector3(v.x, v.y, 0)
              );
              if (entity.shape) pts.push(pts[0].clone());
              geometry = new THREE.BufferGeometry().setFromPoints(pts);
              obj = new THREE.Line(geometry, material);
              scene.add(obj);
              entity.vertices.forEach((v) => allPoints.push(v));
            }
            break;

          case "CIRCLE":
            // if condition to remove the conatruction gemoetry with bed and toilet
            if (entity.layer && (entity.layer.toLowerCase().includes("bed") || entity.layer.toLowerCase().includes("toilet")) && entity.radius > 2.5) break;
            material = new THREE.LineBasicMaterial({ color: getColor(entity) });
            const circlePoints = [];
            for (let i = 0; i <= 64; i++) {
              const angle = (i / 64) * Math.PI * 2;
              circlePoints.push(
                new THREE.Vector3(
                  entity.center.x + entity.radius * Math.cos(angle),
                  entity.center.y + entity.radius * Math.sin(angle),
                  0
                )
              );
            }
            geometry = new THREE.BufferGeometry().setFromPoints(circlePoints);
            obj = new THREE.Line(geometry, material);
            scene.add(obj);
            allPoints.push(
              { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
              { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
            );
            break;

          case "ARC":
            // if condition to remove the conatruction gemoetry with bed and toilet
            if (entity.layer && (entity.layer.toLowerCase().includes("bed") || entity.layer.toLowerCase().includes("toilet")) && entity.radius > 2.5) break;
            material = new THREE.LineBasicMaterial({ color: getColor(entity) });
            const arcPoints = [];
            const startAngle = entity.startAngle;
            const endAngle = entity.endAngle;
            let sweep = endAngle - startAngle;
            if (sweep <= 0) {
              sweep += Math.PI * 2;
            }
            const segments = 100
            for (let i = 0; i <= segments; i++) {
              const angle = startAngle + (i / segments) * sweep;
              arcPoints.push(
                new THREE.Vector3(
                  entity.center.x + entity.radius * Math.cos(angle),
                  entity.center.y + entity.radius * Math.sin(angle),
                  0
                )
              );
            }
            geometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
            obj = new THREE.Line(geometry, material);
            scene.add(obj);
            allPoints.push(
              { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
              { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
            );
            break;

          case "POINT":
            if (entity.position) {
              allPoints.push(entity.position);
            }
            break;

          case "INSERT": {
            if (!dxf.blocks || !dxf.blocks[entity.name]) break;

            const block = dxf.blocks[entity.name];
            const insertX = entity.position?.x || 0;
            const insertY = entity.position?.y || 0;
            const scaleX = entity.xScale || 1;
            const scaleY = entity.yScale || 1;
            const rotation = (entity.rotation || 0) * Math.PI / 180;

            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);

            function transformPoint(x, y) {
              // 1. scale
              let sx = x * scaleX;
              let sy = y * scaleY;

              // 2. rotate
              let rx = sx * cos - sy * sin;
              let ry = sx * sin + sy * cos;

              // 3. translate
              return {
                x: rx + insertX,
                y: ry + insertY
              };
            }

            block.entities.forEach((child) => {

              switch (child.type) {

                case "LINE": {
                  const p1 = transformPoint(child.vertices[0].x, child.vertices[0].y);
                  const p2 = transformPoint(child.vertices[1].x, child.vertices[1].y);

                  const material = new THREE.LineBasicMaterial({ color: getColor(child) });
                  const geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(p1.x, p1.y, 0),
                    new THREE.Vector3(p2.x, p2.y, 0)
                  ]);
                  const line = new THREE.Line(geometry, material);
                  scene.add(line);

                  allPoints.push(p1, p2);
                  break;
                }

                case "LWPOLYLINE":
                case "POLYLINE": {
                  if (!child.vertices || child.vertices.length < 2) break;

                  const pts = child.vertices.map(v => {
                    const p = transformPoint(v.x, v.y);
                    allPoints.push(p);
                    return new THREE.Vector3(p.x, p.y, 0);
                  });

                  if (child.shape) pts.push(pts[0].clone());

                  const material = new THREE.LineBasicMaterial({ color: getColor(child) });
                  const geometry = new THREE.BufferGeometry().setFromPoints(pts);
                  const poly = new THREE.Line(geometry, material);
                  scene.add(poly);
                  break;
                }

                case "CIRCLE": {
                  // if condition to remove the conatruction gemoetry with bed and toilet
                  if (entity.name && entity.name.toLowerCase().includes("bed") && child.radius > 2.5) break;
                  const center = transformPoint(child.center.x, child.center.y);
                  const radius = child.radius * Math.max(scaleX, scaleY);

                  const circlePoints = [];
                  for (let i = 0; i <= 64; i++) {
                    const angle = (i / 64) * Math.PI * 2;
                    const x = center.x + radius * Math.cos(angle);
                    const y = center.y + radius * Math.sin(angle);
                    circlePoints.push(new THREE.Vector3(x, y, 0));
                  }

                  const material = new THREE.LineBasicMaterial({ color: getColor(child) });
                  const geometry = new THREE.BufferGeometry().setFromPoints(circlePoints);
                  const circle = new THREE.Line(geometry, material);
                  scene.add(circle);

                  allPoints.push(
                    { x: center.x - radius, y: center.y - radius },
                    { x: center.x + radius, y: center.y + radius }
                  );
                  break;
                }

                case "ARC": {
                  // if condition to remove the conatruction gemoetry with bed and toilet
                  if (entity.name && entity.name.toLowerCase().includes("bed") && child.radius > 2.5) break;
                  const center = transformPoint(child.center.x, child.center.y);
                  const radius = child.radius * Math.max(scaleX, scaleY);

                  const baseStart = child.startAngle;
                  const baseEnd = child.endAngle;

                  // ADD rotation of block
                  const startAngle = baseStart + rotation;
                  const endAngle = baseEnd + rotation;

                  let sweep = endAngle - startAngle;
                  if (sweep < 0) sweep += Math.PI * 2;

                  const arcPoints = [];
                  const segments = 200;
                  for (let i = 0; i <= segments; i++) {
                    const angle = startAngle + (i / segments) * sweep;
                    const x = center.x + radius * Math.cos(angle);
                    const y = center.y + radius * Math.sin(angle);
                    arcPoints.push(new THREE.Vector3(x, y, 0));
                  }

                  const material = new THREE.LineBasicMaterial({ color: getColor(child) });
                  const geometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
                  const arc = new THREE.Line(geometry, material);
                  scene.add(arc);

                  allPoints.push(
                    { x: center.x - radius, y: center.y - radius },
                    { x: center.x + radius, y: center.y + radius }
                  );
                  break;
                }

                case "TEXT":
                case "MTEXT": {
                  const text = child.text || child.contents;
                  if (!text) break;

                  const px = child.startPoint?.x ?? child.position?.x ?? 0;
                  const py = child.startPoint?.y ?? child.position?.y ?? 0;
                  const pos = transformPoint(px, py);

                  const el = document.createElement('div');
                  el.textContent = text;
                  Object.assign(el.style, {
                    position: 'absolute',
                    color: '#' + getColor(child).getHexString(),
                    fontFamily: 'Inter, sans-serif',
                    whiteSpace: 'nowrap',
                    transform: 'translate(-50%, -50%)',
                  });
                  textOverlay.appendChild(el);

                  textElements.push({
                    el,
                    x: pos.x,
                    y: pos.y,
                    height: (child.height || 0.2) * Math.max(scaleX, scaleY)
                  });

                  allPoints.push(pos);
                  break;
                }
              }
            });

            break;
          }

          case "TEXT":
          case "MTEXT": {
            const text = entity.text || entity.contents;
            if (!text) break;

            const px = entity.startPoint?.x ?? entity.position?.x ?? 0;
            const py = entity.startPoint?.y ?? entity.position?.y ?? 0;

            const el = document.createElement('div');
            el.textContent = text;
            Object.assign(el.style, {
              position: 'absolute',
              color: '#' + getColor(entity).getHexString(),
              fontFamily: 'Inter, sans-serif',
              whiteSpace: 'nowrap',
              transform: 'translate(-50%, -50%)',
            });
            textOverlay.appendChild(el);

            textElements.push({
              el,
              x: px,
              y: py,
              height: entity.height || 0.2
            });

            allPoints.push({ x: px, y: py });
            break;
          }

          default:
            // Skip DIMENSION, etc.
            break;
        }
      });
    }

    // Calculate bounding box and set up orthographic camera
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allPoints.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });

    if (allPoints.length === 0) {
      minX = -10; minY = -10; maxX = 10; maxY = 10;
    }

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const margin = 1.1;
    const aspect = width / height;
    let halfW, halfH;
    if (dx / dy > aspect) {
      halfW = (dx * margin) / 2;
      halfH = halfW / aspect;
    } else {
      halfH = (dy * margin) / 2;
      halfW = halfH * aspect;
    }

    const camera = new THREE.OrthographicCamera(
      cx - halfW, cx + halfW, cy + halfH, cy - halfH, -10, 10
    );
    camera.position.set(0, 0, 5);

    renderer.render(scene, camera);

    // ── Helper: compute pixels-per-meter and update scale bars ───────────
    function updateScale() {
      const worldWidth = camera.right - camera.left;
      const ppm = width / worldWidth; // pixels per DXF unit (= 1 m)
      scaleBar.update(ppm);

      const mapX = (x) => ((x - camera.left) / (camera.right - camera.left)) * width;
      const mapY = (y) => (1 - (y - camera.bottom) / (camera.top - camera.bottom)) * height;

      textElements.forEach(({ el, x, y, height }) => {
        const px = mapX(x);
        const py = mapY(y);
        el.style.left = px + 'px';
        el.style.top = py + 'px';
        el.style.fontSize = Math.max(8, height * ppm) + 'px';
      });
    }
    updateScale(); // initial render

    // Interactive controls: pan (drag) and zoom (scroll)
    let isDragging = false;
    let prev = { x: 0, y: 0 };

    renderer.domElement.addEventListener("mousedown", (e) => {
      isDragging = true;
      prev = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dxPx = e.clientX - prev.x;
      const dyPx = e.clientY - prev.y;
      const scaleX = (camera.right - camera.left) / width;
      const scaleY = (camera.top - camera.bottom) / height;
      camera.left -= dxPx * scaleX;
      camera.right -= dxPx * scaleX;
      camera.bottom += dyPx * scaleY;
      camera.top += dyPx * scaleY;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      updateScale();
      prev = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener("mouseup", () => { isDragging = false; });
    renderer.domElement.addEventListener("mouseleave", () => { isDragging = false; });

    renderer.domElement.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoom = e.deltaY > 0 ? 1.1 : 0.9;
      const cxCam = (camera.left + camera.right) / 2;
      const cyCam = (camera.bottom + camera.top) / 2;
      const newHalfW = ((camera.right - camera.left) / 2) * zoom;
      const newHalfH = ((camera.top - camera.bottom) / 2) * zoom;
      camera.left = cxCam - newHalfW;
      camera.right = cxCam + newHalfW;
      camera.bottom = cyCam - newHalfH;
      camera.top = cyCam + newHalfH;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      updateScale();
    });

  } catch (error) {
    console.error("DXF viewer error:", error);
    container.innerHTML = `<div class="viewer-loading">Failed to load DXF: ${error.message}</div>`;
  }
}

sendBtn.addEventListener("click", async () => {
  const text = input.value.trim();
  if (!text) return;
  function getProgressType(prompt) {
  const p = prompt.toLowerCase();
  const asset_edit_keywords = ["move", "remove", "delete", "rotate", "shift", "slide", "add", "place", "put", "insert", "adjust", "nudge", "swap", "replace", "reposition", "turn"]
        
  const isEdit = asset_edit_keywords.some(keyword => p.includes(keyword));

  if (isEdit) return "edit";
  return "default";
}
  const attachedFiles = Array.from(fileInput.files).map((f) => f.name);

  // user message
  addMessage({ role: "user", text, files: attachedFiles });
  const loader = addLoadingMessage("Starting...");
  const progressType = getProgressType(text);
  const progressInterval = simulateProgress(loader, progressType);

  // clear input / files
  input.value = "";
  autoGrow();
  sendBtn.disabled = true;
  attachBtn.disabled = true;
  fileInput.value = "";
  fileList.innerHTML = "";

  // Starting fresh conversation — clear any stale history
  if (chatHistory.length === 0) {
    _clearChatHistory();
  }

  try {
    // Create FormData with prompt and files
    const formData = new FormData();
    formData.append("prompt", text);

    Array.from(fileInput.files).forEach((file) => {
      formData.append("files", file);
    });

    // Make POST request to server
    const response = await fetch("/chat", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();
    clearInterval(progressInterval);
    loader.remove();

    // Check if this is an async task (new Celery-based flow)
    if (data.task_id) {
      // Show a "generating" message
      addMessage({
        role: "ai",
        text: "Generating your floor plan... This may take a minute.",
        documentId: null,
        files: null,
      });

      // Poll /status/<task_id> until done
      let attempts = 0;
      const maxAttempts = 120; // ~8 minutes
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 4000));
        const statusRes = await fetch(`/status/${data.task_id}`);
        const statusData = await statusRes.json();

        if (statusData.success) {
          // Task completed successfully
          const result = statusData.result || {};
          addMessage({
            role: "ai",
            text: result.response || "Floor plan generated successfully!",
            documentId: statusData.document_id || result.document_id || null,
            files: null,
            thoughts: result.thoughts || null
          });
          break;
        } else if (statusData.status === "FAILURE" || (statusData.status === "SUCCESS" && !statusData.success)) {
          // FAILURE = Celery-level crash, SUCCESS with success=false = task ran but errored
          addMessage({
            role: "ai",
            text: `Generation failed: ${statusData.error || "Unknown error"}`,
            documentId: null,
            files: null,
          });
          break;
        }
        // else still PENDING/STARTED, keep polling
        attempts++;
      }

      if (attempts >= maxAttempts) {
        addMessage({
          role: "ai",
          text: "Generation timed out. Please try again.",
          documentId: null,
          files: null,
        });
      }
    } else {
      // Synchronous response (e.g. asset edits)
      addMessage({
        role: "ai",
        text: data.response || "No response from server.",
        documentId: data.document_id || null,
        files: null,
        thoughts: data.thoughts || null
      });
    }
  } catch (error) {
    clearInterval(progressInterval);
    loader.update("Something went wrong...");
    console.error("Error:", error);
    addMessage({
      role: "ai",
      text: `Error: ${error.message}. Make sure your server is running on /chat endpoint.`,
      documentId: null,
      files: null,
    });
  } finally {
    sendBtn.disabled = false;
    attachBtn.disabled = false;
  }
});

autoGrow();

// ── Restore chat on page load ──────────────────────────────────────────────
async function restoreSession() {
  try {
    const res   = await fetch("/session_state");
    const state = await res.json();

    const storedServerId = localStorage.getItem(SERVER_ID_KEY);
    const serverChanged  = storedServerId && state.server_instance_id !== storedServerId;
    const history        = _loadChatHistory();

    // Always persist the current server ID so we can detect restarts next time
    if (state.server_instance_id) {
      localStorage.setItem(SERVER_ID_KEY, state.server_instance_id);
    }

    // Only clear if the server actually restarted (terminal was killed and restarted)
    if (serverChanged) {
      console.log("[Restore] Server restarted — clearing history.");
      _clearChatHistory();
      return;
    }

    // Restore whatever is in localStorage (even if flow_started=false due to in-flight request on last refresh)
    if (history.length === 0) return;

    console.log("[Restore] Restoring", history.length, "messages.");
    chatHistory = history;
    _isRestoring = true;
    history.forEach(({ role, text, documentId, thoughts }) => {
      addMessage({ role, text, documentId, files: null, thoughts });
    });
    _isRestoring = false;
  } catch (e) {
    console.warn("Session restore failed:", e);
  }
}

restoreSession();
