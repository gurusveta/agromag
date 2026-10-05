// === Каталог растений (правь цены и размеры здесь) ===
const CATALOG = [
  { id: 'juniper-skyrocket', name: 'Можжевельник Skyrocket', h: 3.0, price: 900,  shape: 'cone-thin', color: '#4a7c59' },
  { id: 'juniper-bluechip',  name: 'Можжевельник Blue Chip',  h: 0.4, price: 500,  shape: 'ball-flat', color: '#6b8e9e' },
  { id: 'juniper-mintjulep', name: 'Можжевельник Mint Julep', h: 1.2, price: 700,  shape: 'bush',      color: '#7fa86b' },
  { id: 'thuja-smaragd',     name: 'Туя Smaragd',             h: 2.5, price: 1100, shape: 'cone-thin', color: '#2e5c3a' },
  { id: 'thuja-brabant',     name: 'Туя Brabant',             h: 3.5, price: 900,  shape: 'cone-wide', color: '#3a6b47' },
  { id: 'thuja-woodwardii',  name: 'Туя Woodwardii',          h: 1.2, price: 950,  shape: 'ball',      color: '#3d6e4a' },
  { id: 'thuja-danica',      name: 'Туя Danica',              h: 0.6, price: 700,  shape: 'ball',      color: '#4a7c59' },
  { id: 'thuja-mrbowling',   name: 'Туя Mr. Bowling Ball',    h: 0.7, price: 850,  shape: 'ball',      color: '#547d5f' },
  { id: 'spruce-superblue',  name: 'Ель Super Blue Seedling', h: 3.0, price: 2500, shape: 'cone',      color: '#7ba8c0' },
  { id: 'spruce-edith',      name: 'Ель Edith',               h: 2.0, price: 2800, shape: 'cone',      color: '#8db8cc' },
  { id: 'spruce-glauca',     name: 'Ель Glauca',              h: 4.0, price: 3000, shape: 'cone',      color: '#6b94ab' },
  { id: 'spruce-common',     name: 'Ель обыкновенная',        h: 4.0, price: 1500, shape: 'cone',      color: '#2f5533' },
  { id: 'spruce-sonya',      name: 'Ель карликовая Sonya',    h: 1.5, price: 3200, shape: 'cone',      color: '#5d8a6e' },
  { id: 'azalea',            name: 'Азалия гибридная',        h: 0.8, price: 1200, shape: 'bush',      color: '#c97b9c' },
  { id: 'hydrangea',         name: 'Гортензия метельчатая',   h: 1.5, price: 1000, shape: 'bush',      color: '#e4b5c8' }
];

// === Расценки на работы (правь здесь) ===
const WORK = {
  planting: 600,   // посадка одного растения
  soil: 250,       // грунт/удобрения на растение
  delivery: 3500,  // доставка, если сумма < freeFrom
  freeFrom: 30000  // бесплатная доставка от этой суммы
};

// === Внутреннее состояние ===
let activePlantId = CATALOG[0].id;
let plants = [];       // { id, typeId, x, y (0..1), scale }
let selectedIdx = -1;
let imgNaturalW = 1, imgNaturalH = 1;

const stage = document.getElementById('stage');
const photo = document.getElementById('photo');
const overlay = document.getElementById('overlay');
const catalogEl = document.getElementById('catalog');
const bomEl = document.getElementById('bom');
const editorEl = document.getElementById('editor');
const statusEl = document.getElementById('status');

// === Загрузка фото ===
document.getElementById('cam').addEventListener('change', loadPhoto);
document.getElementById('gal').addEventListener('change', loadPhoto);

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
      render();
      statusEl.textContent = 'Фото загружено. Тапните по нему, чтобы посадить ' + activeName();
    };
    photo.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// === Рисование растений ===
function svgFor(plant) {
  const c = plant.color;
  const w = 100, h = 100;
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">${body}</svg>`;
}

// Размер растения в пикселях: базовый = 60 px на 1 метр, поправка на перспективу
function plantSizePx(plant) {
  const cat = CATALOG.find(c => c.id === plant.typeId);
  if (!cat) return 60;
  const pxPerMeter = 60;
  let size = cat.h * pxPerMeter * plant.scale;
  // Перспектива: y=0 (верх) → ×0.4, y=1 (низ) → ×1.2
  const perspective = 0.4 + plant.y * 0.8;
  return Math.max(14, size * perspective);
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
    el.innerHTML = svgFor(cat);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedIdx = i;
      render();
      editorEl.style.display = 'block';
    });
    overlay.appendChild(el);
  });
  updateBOM();
}

// === Тап по сцене — посадить растение ===
function stageClick(e) {
  if (photo.style.display === 'none') return;
  const rect = photo.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;
  plants.push({ typeId: activePlantId, x, y, scale: 1 });
  selectedIdx = plants.length - 1;
  render();
  editorEl.style.display = 'block';
  statusEl.textContent = 'Посажено: ' + activeName() + '. Всего растений: ' + plants.length;
}

// === Управление выбранным ===
function grow()    { if (selectedIdx < 0) return; plants[selectedIdx].scale *= 1.15; render(); }
function shrink()  { if (selectedIdx < 0) return; plants[selectedIdx].scale /= 1.15; render(); }
function removeSelected() {
  if (selectedIdx < 0) return;
  plants.splice(selectedIdx, 1);
  selectedIdx = -1;
  editorEl.style.display = 'none';
  render();
}

// === Каталог ===
function renderCatalog() {
  catalogEl.innerHTML = '';
  CATALOG.forEach(c => {
    const div = document.createElement('div');
    div.className = 'item' + (c.id === activePlantId ? ' active' : '');
    div.innerHTML = `<div style="height:36px;margin-bottom:2px">${svgFor(c)}</div>${c.name}<span class="price">${c.price} ₽</span>`;
    div.addEventListener('click', () => {
      activePlantId = c.id;
      renderCatalog();
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
    counts[p.typeId] = (counts[p.typeId] || 0) + 1;
  });
  let totalPlants = 0;
  let rows = '';
  Object.entries(counts).forEach(([typeId, qty]) => {
    const c = CATALOG.find(x => x.id === typeId);
    const sum = c.price * qty;
    totalPlants += sum;
    rows += `<tr><td>${c.name} × ${qty}</td><td>${sum.toLocaleString('ru-RU')} ₽</td></tr>`;
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

// === Скачать PNG (грубо, просто склеиваем фото и наложения через canvas) ===
function downloadPNG() {
  if (photo.style.display === 'none') { alert('Сначала загрузите фото'); return; }
  const canvas = document.createElement('canvas');
  canvas.width = imgNaturalW;
  canvas.height = imgNaturalH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(photo, 0, 0);
  const rect = photo.getBoundingClientRect();
  const scale = imgNaturalW / rect.width;
  plants.forEach(p => {
    const cat = CATALOG.find(c => c.id === p.typeId);
    if (!cat) return;
    const size = plantSizePx(p) * scale;
    const cx = p.x * canvas.width;
    const cy = p.y * canvas.height;
    ctx.save();
    ctx.translate(cx, cy);
    // Простая тень
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.4, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Простая фигура
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.5, size * 0.4, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  const link = document.createElement('a');
  link.download = 'agromag-plan.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// === Старт ===
renderCatalog();
window.addEventListener('resize', render);
window.addEventListener('orientationchange', () => setTimeout(render, 300));

// Пересчёт позиций при загрузке картинки
photo.addEventListener('load', render);
