// === Каталог растений ===
const CATALOG = [
  { id: 'juniper-skyrocket', name: 'Можжевельник Skyrocket', h: 2.0, price: 900,  shape: 'cone-thin', color: '#4a7c59' },
  { id: 'juniper-bluechip',  name: 'Можжевельник Blue Chip',  h: 0.5, price: 500,  shape: 'ball-flat', color: '#6b8e9e' },
  { id: 'juniper-mintjulep', name: 'Можжевельник Mint Julep', h: 1.2, price: 700,  shape: 'bush',      color: '#7fa86b' },
  { id: 'thuja-smaragd',     name: 'Туя Smaragd',             h: 2.0, price: 1100, shape: 'cone-thin', color: '#2e5c3a' },
  { id: 'thuja-brabant',     name: 'Туя Brabant',             h: 2.5, price: 900,  shape: 'cone-wide', color: '#3a6b47' },
  { id: 'thuja-woodwardii',  name: 'Туя Woodwardii',          h: 1.2, price: 950,  shape: 'ball',      color: '#3d6e4a' },
  { id: 'thuja-danica',      name: 'Туя Danica',              h: 0.6, price: 700,  shape: 'ball',      color: '#4a7c59' },
  { id: 'thuja-mrbowling',   name: 'Туя Mr. Bowling Ball',    h: 0.7, price: 850,  shape: 'ball',      color: '#547d5f' },
  { id: 'spruce-superblue',  name: 'Ель Super Blue Seedling', h: 2.5, price: 2500, shape: 'cone',      color: '#7ba8c0' },
  { id: 'spruce-edith',      name: 'Ель Edith',               h: 1.5, price: 2800, shape: 'cone',      color: '#8db8cc' },
  { id: 'spruce-glauca',     name: 'Ель Glauca',              h: 3.0, price: 3000, shape: 'cone',      color: '#6b94ab' },
  { id: 'spruce-common',     name: 'Ель обыкновенная',        h: 3.0, price: 1500, shape: 'cone',      color: '#2f5533' },
  { id: 'spruce-sonya',      name: 'Ель карликовая Sonya',    h: 1.2, price: 3200, shape: 'cone',      color: '#5d8a6e' },
  { id: 'azalea',            name: 'Азалия гибридная',        h: 0.8, price: 1200, shape: 'bush',      color: '#c97b9c' },
  { id: 'hydrangea',         name: 'Гортензия метельчатая',   h: 1.5, price: 1000, shape: 'bush',      color: '#e4b5c8' }
];

const WORK = {
  planting: 600,
  soil: 250,
  delivery: 3500,
  freeFrom: 30000
};

const PRICE_POW = 1.5;

function calcPrice(plant) {
  const cat = CATALOG.find(c => c.id === plant.typeId);
  if (!cat) return 0;
  const ratio = plant.height / cat.h;
  return Math.round(cat.price * Math.pow(ratio, PRICE_POW));
}

// === Состояние ===
let activePlantId = CATALOG[0].id;
let plants = [];
let selectedIdx = -1;
let imgNaturalW = 1, imgNaturalH = 1;
let processedImages = {}; // id -> dataURL с прозрачным фоном
let pngCache = {};        // id -> есть ли PNG (или уже обработан)

const stage = document.getElementById('stage');
const photo = document.getElementById('photo');
const overlay = document.getElementById('overlay');
const catalogEl = document.getElementById('catalog');
const bomEl = document.getElementById('bom');
const editorEl = document.getElementById('editor');
const editorTitle = document.getElementById('editorTitle');
const statusEl = document.getElementById('status');
const heightSlider = document.getElementById('heightSlider');
const heightVal = document.getElementById('heightVal');

document.getElementById('cam').addEventListener('change', loadPhoto);
document.getElementById('gal').addEventListener('change', loadPhoto);
heightSlider.addEventListener('input', onHeightChange);

function loadPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    photo.onload = () => {
      imgNaturalW = photo.naturalWidth;
      imgNaturalH = photo.naturalHeight;
      stage.classList.remove('empty');
      photo.style.display = 'block';
      stage.querySelector('span').style.display = 'none';
      plants = [];
      selectedIdx = -1;
      editorEl.style.display = 'none';
      render();
      setStatus('Фото загружено. Тапните по нему, чтобы посадить ' + activeName());
    };
    photo.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// === Удаление белого фона через canvas ===
function removeWhiteBackground(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  // Порог: пиксели, где R,G,B >= 235 → прозрачные
  const THRESHOLD = 235;
  // Плавный переход: 200..255
  const SOFT_MIN = 200;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    const minChannel = Math.min(r, g, b);
    if (minChannel >= THRESHOLD) {
      d[i+3] = 0; // полностью прозрачный
    } else if (minChannel >= SOFT_MIN) {
      // Плавное затухание
      const t = (minChannel - SOFT_MIN) / (THRESHOLD - SOFT_MIN);
      d[i+3] = Math.round(255 * (1 - t));
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

// Загрузка PNG + удаление фона
function loadAndProcess(id) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const processed = removeWhiteBackground(img);
        processedImages[id] = processed;
        pngCache[id] = true;
        resolve(true);
      } catch (e) {
        // Если canvas не смог (CORS) — используем оригинал
        processedImages[id] = img.src;
        pngCache[id] = true;
        resolve(true);
      }
    };
    img.onerror = () => {
      pngCache[id] = false;
      resolve(false);
    };
    img.src = 'plants/' + id + '.png';
  });
}

function svgFor(plant) {
  const c = plant.color;
  let body = '';
  if (plant.shape === 'cone-thin') {
    body = `<polygon points="50,5 78,95 22,95" fill="${c}"/>`;
  } else if (plant.shape === 'cone-wide') {
    body = `<polygon points="50,5 88,95 12,95" fill="${c}"/>`;
  } else if (plant.shape === 'cone') {
    body = `<polygon points="50,5 80,60 65,60 88,95 12,95 35,60 20,60" fill="${c}"/>`;
  } else if (plant.shape === 'ball') {
    body = `<ellipse cx="50" cy="55" rx="42" ry="42" fill="${c}"/>`;
  } else if (plant.shape === 'ball-flat') {
    body = `<ellipse cx="50" cy="65" rx="48" ry="30" fill="${c}"/>`;
  } else if (plant.shape === 'bush') {
    body = `<ellipse cx="35" cy="60" rx="30" ry="35" fill="${c}"/>
            <ellipse cx="65" cy="55" rx="32" ry="38" fill="${c}"/>
            <ellipse cx="50" cy="70" rx="38" ry="28" fill="${c}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">${body}</svg>`;
}

function renderPlantHTML(cat) {
  if (pngCache[cat.id] && processedImages[cat.id]) {
    return `<img src="${processedImages[cat.id]}" alt="">`;
  }
  return svgFor(cat);
}

function plantSizePx(plant) {
  const pxPerMeter = 60;
  const perspective = 0.4 + plant.y * 0.8;
  const size = plant.height * pxPerMeter * perspective;
  return Math.max(14, size);
}

function render() {
  overlay.innerHTML = '';
  const rect = photo.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const offsetX = rect.left - stageRect.left;
  const offsetY = rect.top - stageRect.top;

  plants.forEach((p, i) => {
    const cat = CATALOG.find(c => c.id === p.typeId);
    if (!cat) return;
    const size = plantSizePx(p);
    const el = document.createElement('div');
    el.className = 'plant' + (i === selectedIdx ? ' selected' : '');
    el.style.left = (offsetX + p.x * rect.width) + 'px';
    el.style.top  = (offsetY + p.y * rect.height) + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.dataset.idx = i;
    el.innerHTML = renderPlantHTML(cat);
    overlay.appendChild(el);
  });
  updateBOM();
}

// === Pointer-логика ===
let pointer = null;

function findPlantAt(clientX, clientY) {
  const rect = photo.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const offsetX = rect.left - stageRect.left;
  const offsetY = rect.top - stageRect.top;
  const px = clientX - stageRect.left;
  const py = clientY - stageRect.top;

  let best = -1;
  let bestDist = 9999;
  const GRAB = 55;

  plants.forEach((p, i) => {
    const size = plantSizePx(p);
    const cx = offsetX + p.x * rect.width;
    const cy = offsetY + p.y * rect.height - size / 2;
    const dx = px - cx;
    const dy = py - cy;
    const d = Math.hypot(dx, dy);
    if (d < GRAB + size / 2 && d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

stage.addEventListener('pointerdown', e => {
  if (photo.style.display === 'none') return;
  const idx = findPlantAt(e.clientX, e.clientY);

  if (idx >= 0) {
    selectedIdx = idx;
    openEditor();
    const rect = photo.getBoundingClientRect();
    const p = plants[idx];
    pointer = {
      idx,
      startX: e.clientX,
      startY: e.clientY,
      origX: p.x,
      origY: p.y,
      rectW: rect.width,
      rectH: rect.height,
      moved: false
    };
    stage.setPointerCapture(e.pointerId);
    render();
    e.preventDefault();
  } else {
    const rect = photo.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const cat = CATALOG.find(c => c.id === activePlantId);
    plants.push({ typeId: activePlantId, x, y, height: cat.h });
    selectedIdx = plants.length - 1;
    openEditor();
    render();
    setStatus('Посажено: ' + activeName() + ' (' + cat.h.toFixed(1) + ' м)');
    e.preventDefault();
  }
}, { passive: false });

stage.addEventListener('pointermove', e => {
  if (!pointer) return;
  const dx = e.clientX - pointer.startX;
  const dy = e.clientY - pointer.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) pointer.moved = true;

  let nx = pointer.origX + dx / pointer.rectW;
  let ny = pointer.origY + dy / pointer.rectH;
  nx = Math.max(0, Math.min(1, nx));
  ny = Math.max(0, Math.min(1, ny));

  plants[pointer.idx].x = nx;
  plants[pointer.idx].y = ny;
  render();
  e.preventDefault();
}, { passive: false });

stage.addEventListener('pointerup', e => {
  if (!pointer) return;
  if (pointer.moved) setStatus('Растение перемещено');
  pointer = null;
});
stage.addEventListener('pointercancel', () => { pointer = null; });

// === Редактор ===
function openEditor() {
  if (selectedIdx < 0) { editorEl.style.display = 'none'; return; }
  const p = plants[selectedIdx];
  const cat = CATALOG.find(c => c.id === p.typeId);
  if (!cat) return;
  editorEl.style.display = 'block';
  editorTitle.textContent = cat.name;
  heightSlider.min = Math.round(cat.h * 30);
  heightSlider.max = Math.round(cat.h * 300);
  heightSlider.value = Math.round(p.height * 100);
  updateHeightLabel();
}
function updateHeightLabel() {
  const p = plants[selectedIdx];
  if (!p) return;
  heightVal.textContent = p.height.toFixed(1) + ' м';
}
function onHeightChange() {
  if (selectedIdx < 0) return;
  const p = plants[selectedIdx];
  p.height = parseInt(heightSlider.value) / 100;
  updateHeightLabel();
  render();
}
function resetSize() {
  if (selectedIdx < 0) return;
  const cat = CATALOG.find(c => c.id === plants[selectedIdx].typeId);
  plants[selectedIdx].height = cat.h;
  heightSlider.value = Math.round(cat.h * 100);
  updateHeightLabel();
  render();
}
function removeSelected() {
  if (selectedIdx < 0) return;
  const name = CATALOG.find(c => c.id === plants[selectedIdx].typeId).name;
  plants.splice(selectedIdx, 1);
  selectedIdx = -1;
  editorEl.style.display = 'none';
  render();
  setStatus('Удалено: ' + name + '. Осталось растений: ' + plants.length);
}

// === Каталог ===
function renderCatalog() {
  catalogEl.innerHTML = '';
  CATALOG.forEach(c => {
    const div = document.createElement('div');
    div.className = 'item' + (c.id === activePlantId ? ' active' : '');
    div.innerHTML = `<div class="thumb">${renderPlantHTML(c)}</div>${c.name}<span class="price">от ${c.price} ₽</span>`;
    div.addEventListener('click', () => {
      activePlantId = c.id;
      renderCatalog();
      setStatus('Активное растение: ' + c.name);
    });
    catalogEl.appendChild(div);
  });
}
function activeName() {
  const c = CATALOG.find(x => x.id === activePlantId);
  return c ? c.name : '';
}

// === Смета ===
function updateBOM() {
  if (plants.length === 0) {
    bomEl.innerHTML = '<tr><td colspan="2" style="color:#888">Пока ничего не посажено</td></tr>';
    return;
  }
  const counts = {};
  plants.forEach(p => {
    const key = p.typeId + '@' + p.height.toFixed(1);
    if (!counts[key]) counts[key] = { typeId: p.typeId, height: p.height, qty: 0 };
    counts[key].qty++;
  });

  let totalPlants = 0;
  let rows = '';
  Object.values(counts).forEach(g => {
    const cat = CATALOG.find(x => x.id === g.typeId);
    const unit = calcPrice({ typeId: g.typeId, height: g.height });
    const sum = unit * g.qty;
    totalPlants += sum;
    rows += `<tr><td>${cat.name} · ${g.height.toFixed(1)} м × ${g.qty}<br><small>${unit.toLocaleString('ru-RU')} ₽ / шт</small></td><td>${sum.toLocaleString('ru-RU')} ₽</td></tr>`;
  });

  const totalCount = plants.length;
  const planting = totalCount * WORK.planting;
  const soil = totalCount * WORK.soil;
  const delivery = totalPlants >= WORK.freeFrom ? 0 : WORK.delivery;
  const grand = totalPlants + planting + soil + delivery;

  rows += `<tr class="subtotal"><td>Посадка (${totalCount} × ${WORK.planting} ₽)</td><td>${planting.toLocaleString('ru-RU')} ₽</td></tr>`;
  rows += `<tr class="subtotal"><td>Грунт и удобрения (${totalCount} × ${WORK.soil} ₽)</td><td>${soil.toLocaleString('ru-RU')} ₽</td></tr>`;
  rows += `<tr class="subtotal"><td>Доставка</td><td>${delivery === 0 ? 'бесплатно' : delivery.toLocaleString('ru-RU') + ' ₽'}</td></tr>`;
  rows += `<tr class="total"><td>Итого</td><td>${grand.toLocaleString('ru-RU')} ₽</td></tr>`;
  bomEl.innerHTML = rows;
}
function setStatus(t) { statusEl.textContent = t; }

// === Скачать PNG ===
function downloadPNG() {
  if (photo.style.display === 'none') { alert('Сначала загрузите фото'); return; }
  const canvas = document.createElement('canvas');
  canvas.width = imgNaturalW;
  canvas.height = imgNaturalH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(photo, 0, 0);
  const rect = photo.getBoundingClientRect();
  const scale = imgNaturalW / rect.width;

  const tasks = plants.map(p => new Promise(resolve => {
    const cat = CATALOG.find(c => c.id === p.typeId);
    if (!cat) return resolve();
    const size = plantSizePx(p) * scale;
    const cx = p.x * canvas.width;
    const cy = p.y * canvas.height;

    const finish = (img) => {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.4, size * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      if (img) {
        ctx.drawImage(img, cx - size / 2, cy - size, size, size);
      } else {
        ctx.fillStyle = cat.color;
        ctx.beginPath();
        ctx.ellipse(cx, cy - size * 0.5, size * 0.4, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      resolve();
    };

    if (pngCache[cat.id] && processedImages[cat.id]) {
      const img = new Image();
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = processedImages[cat.id];
    } else {
      finish(null);
    }
  }));

  Promise.all(tasks).then(() => {
    const link = document.createElement('a');
    link.download = 'agromag-plan.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

// === Старт ===
async function init() {
  setStatus('Загружаем картинки растений…');
  await Promise.all(CATALOG.map(c => loadAndProcess(c.id)));
  renderCatalog();
  setStatus('Готово к работе');
}

init();

window.addEventListener('resize', render);
window.addEventListener('orientationchange', () => setTimeout(render, 300));
photo.addEventListener('load', render);
