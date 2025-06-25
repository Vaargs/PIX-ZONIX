document.getElementById('purchase-self').onclick = async () => {
    const id = parseInt(document.getElementById('purchase-id').textContent);
    const category = document.getElementById('category-select').value;
    const owner = defaultOwner;
    
    // Базовая цена
    let totalPrice = pixelData[id]?.salePrice || defaultPrice;
    
    await buyPixel(id, totalPrice);
    const pixel = document.querySelector(`.pixel[data-id='${id}']`);
    if (pixel) {
      pixel.classList.add('taken', 'owner-group');
      pixel.classList.add('star-explosion');
      setTimeout(() => pixel.classList.remove('star-explosion'), 800);
    }
    
    pixelData[id] = {
      ...pixelData[id],
      category: category,
      taken: true,
      owner: owner,
      date: new Date().toLocaleString()
    };
    
    // Проверяем соседние пиксели для автоматического объединения
    const neighbors = getOwnerNeighbors(id, owner);
    if (neighbors.length > 0) {
      const allPixels = [id, ...neighbors];
      const groupId = createOrUpdateGroup(allPixels, owner);
      
      setTimeout(() => {
        mergePixelGroup(groupId);
      }, 1000);
    }
    
    localStorage.setItem('pixelData', JSON.stringify(pixelData));
    closeAllModals();
    
    // Показываем сообщение о возможности загрузки изображения
    alert('🎉 Пиксель куплен! Теперь вы можете загрузить картинку в купленные пиксели через двойной клик или кнопку "Редактор".');
  };document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById("pixel-grid");
  const wrapper = document.getElementById("pixel-wrapper");
  const gridSize = 50;
  const total = gridSize * gridSize;

  let savedTaken = JSON.parse(localStorage.getItem("takenPixels")) || [];
  let pixelData = JSON.parse(localStorage.getItem("pixelData")) || {};
  let pixelGroups = JSON.parse(localStorage.getItem("pixelGroups")) || {}; // Новое: группы пикселей
  let imageEditor = null; // Редактор изображений
  let selectedPixelsForImage = []; // Пиксели для редактора изображений
  let focusedPixel = null; // Текущий фокусированный пиксель
  let selectionMode = false;
  let selectedPixels = [];
  let scale = 1;
  let offset = { x: 0, y: 0 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  const defaultPrice = 35;
  const mergePrice = 0.15; // 15% доплата за объединение
  const telegram = window.Telegram?.WebApp || { ready: () => {}, initDataUnsafe: { user: null } };
  telegram.ready();
  const user = telegram.initDataUnsafe?.user;
  const defaultOwner = user ? `@${user.username}` : '@you';

  const tonConnectUI = window.TONConnectUI ? new TONConnectUI({
    manifestUrl: 'https://nft-zonix.vercel.app/tonconnect-manifest.json'
  }) : { connectWallet: () => console.log('TON Wallet mock'), onStatusChange: () => {} };
  document.getElementById('connect-ton').onclick = () => tonConnectUI.connectWallet();
  tonConnectUI.onStatusChange(wallet => {
    if (wallet) console.log('Wallet connected:', wallet.account.address);
  });

  // Новые функции для редактора изображений
  function openImageEditor(pixels) {
    if (pixels.length === 0) {
      alert("Выберите хотя бы один пиксель.");
      return;
    }
    
    selectedPixelsForImage = pixels;
    
    // Вычисляем размеры области
    const rows = pixels.map(id => Math.floor(id / gridSize));
    const cols = pixels.map(id => id % gridSize);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    
    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    
    // Устанавливаем размеры в модальном окне
    document.getElementById('editor-dimensions').textContent = `${width}x${height} пикселей`;
    document.getElementById('editor-pixels-count').textContent = pixels.length;
    
    // Инициализируем canvas
    initImageEditor(width * 50, height * 50); // Масштабируем для удобства редактирования
    
    document.getElementById('image-editor-modal').classList.remove('hidden');
  }

  function initImageEditor(canvasWidth, canvasHeight) {
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const displayWidth = Math.min(canvasWidth, 400);
    const displayHeight = Math.min(canvasHeight, 400);
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    
    // Очищаем канвас
    ctx.fillStyle = '#2A3D5A';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Рисуем сетку
    drawGrid(ctx, displayWidth, displayHeight);
    
    imageEditor = {
      canvas: canvas,
      ctx: ctx,
      image: null,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      isDragging: false,
      isResizing: false,
      lastX: 0,
      lastY: 0,
      displayWidth: displayWidth,
      displayHeight: displayHeight,
      imageWidth: 0,
      imageHeight: 0
    };
    
    setupImageEditorEvents();
    createPreview();
  }

  function drawGrid(ctx, width, height) {
    ctx.strokeStyle = '#00D4FF';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    
    const cols = Math.max(...selectedPixelsForImage.map(id => id % gridSize)) - Math.min(...selectedPixelsForImage.map(id => id % gridSize)) + 1;
    const rows = Math.max(...selectedPixelsForImage.map(id => Math.floor(id / gridSize))) - Math.min(...selectedPixelsForImage.map(id => Math.floor(id / gridSize))) + 1;
    
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    
    for (let x = 0; x <= width; x += cellWidth) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= height; y += cellHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  }

  function createPreview() {
    const previewContainer = document.getElementById('editor-preview');
    previewContainer.innerHTML = '';
    
    const cols = Math.max(...selectedPixelsForImage.map(id => id % gridSize)) - Math.min(...selectedPixelsForImage.map(id => id % gridSize)) + 1;
    const rows = Math.max(...selectedPixelsForImage.map(id => Math.floor(id / gridSize))) - Math.min(...selectedPixelsForImage.map(id => Math.floor(id / gridSize))) + 1;
    
    previewContainer.style.display = 'grid';
    previewContainer.style.gridTemplateColumns = `repeat(${cols}, 12px)`;
    previewContainer.style.gridTemplateRows = `repeat(${rows}, 12px)`;
    previewContainer.style.gap = '1px';
    previewContainer.style.margin = '10px auto';
    previewContainer.style.width = 'fit-content';
    previewContainer.style.border = '1px solid #00D4FF';
    previewContainer.style.padding = '2px';
    previewContainer.style.borderRadius = '4px';
    
    const minRow = Math.min(...selectedPixelsForImage.map(id => Math.floor(id / gridSize)));
    const minCol = Math.min(...selectedPixelsForImage.map(id => id % gridSize));
    
    selectedPixelsForImage.forEach(pixelId => {
      const row = Math.floor(pixelId / gridSize) - minRow;
      const col = (pixelId % gridSize) - minCol;
      
      const previewPixel = document.createElement('div');
      previewPixel.style.width = '12px';
      previewPixel.style.height = '12px';
      previewPixel.style.backgroundColor = '#444';
      previewPixel.style.border = '0.5px solid #00D4FF';
      previewPixel.dataset.row = row;
      previewPixel.dataset.col = col;
      previewPixel.dataset.id = pixelId;
      
      previewContainer.appendChild(previewPixel);
    });
  }

  function updatePreview() {
    if (!imageEditor || !imageEditor.image) return;
    
    const canvas = imageEditor.canvas;
    const cols = Math.max(...selectedPixelsForImage.map(id => id % gridSize)) - Math.min(...selectedPixelsForImage.map(id => id % gridSize)) + 1;
    const rows = Math.max(...selectedPixelsForImage.map(id => Math.floor(id / gridSize))) - Math.min(...selectedPixelsForImage.map(id => Math.floor(id / gridSize))) + 1;
    
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;
    
    // Создаем временный canvas для предпросмотра
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = cellWidth;
    tempCanvas.height = cellHeight;
    
    const previewPixels = document.querySelectorAll('#editor-preview div');
    
    previewPixels.forEach(previewPixel => {
      const row = parseInt(previewPixel.dataset.row);
      const col = parseInt(previewPixel.dataset.col);
      
      // Очищаем временный canvas
      tempCtx.clearRect(0, 0, cellWidth, cellHeight);
      
      // Копируем часть основного canvas
      tempCtx.drawImage(
        canvas,
        col * cellWidth, row * cellHeight, cellWidth, cellHeight,
        0, 0, cellWidth, cellHeight
      );
      
      // Применяем к preview пикселю
      const imageData = tempCanvas.toDataURL('image/png');
      previewPixel.style.backgroundImage = `url(${imageData})`;
      previewPixel.style.backgroundSize = 'cover';
      previewPixel.style.backgroundPosition = 'center';
    });
  }

  function setupImageEditorEvents() {
    const canvas = imageEditor.canvas;
    
    // Загрузка изображения
    document.getElementById('editor-file-input').onchange = (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            imageEditor.image = img;
            imageEditor.imageWidth = img.width;
            imageEditor.imageHeight = img.height;
            
            // Позиционируем изображение в центре
            imageEditor.offsetX = (canvas.width - img.width) / 2;
            imageEditor.offsetY = (canvas.height - img.height) / 2;
            imageEditor.scale = 1;
            
            redrawCanvas();
            updatePreview();
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
    
    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
      if (!imageEditor.image) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Проверяем, находится ли курсор в углу изображения для изменения размера
      const imgRight = imageEditor.offsetX + imageEditor.imageWidth * imageEditor.scale;
      const imgBottom = imageEditor.offsetY + imageEditor.imageHeight * imageEditor.scale;
      
      if (x > imgRight - 10 && x < imgRight + 10 && y > imgBottom - 10 && y < imgBottom + 10) {
        imageEditor.isResizing = true;
        canvas.style.cursor = 'nw-resize';
      } else {
        imageEditor.isDragging = true;
        canvas.style.cursor = 'grabbing';
      }
      
      imageEditor.lastX = x;
      imageEditor.lastY = y;
    });
    
    canvas.addEventListener('mousemove', (e) => {
      if (!imageEditor.image) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (imageEditor.isResizing) {
        const deltaX = x - imageEditor.lastX;
        const deltaY = y - imageEditor.lastY;
        
        // Изменяем масштаб пропорционально
        const scaleDelta = Math.max(deltaX, deltaY) / 100;
        imageEditor.scale = Math.max(0.1, Math.min(imageEditor.scale + scaleDelta, 5));
        
        imageEditor.lastX = x;
        imageEditor.lastY = y;
        
        redrawCanvas();
        updatePreview();
        
      } else if (imageEditor.isDragging) {
        imageEditor.offsetX += x - imageEditor.lastX;
        imageEditor.offsetY += y - imageEditor.lastY;
        
        imageEditor.lastX = x;
        imageEditor.lastY = y;
        
        redrawCanvas();
        updatePreview();
        
      } else {
        // Показываем курсор изменения размера в углу
        const imgRight = imageEditor.offsetX + imageEditor.imageWidth * imageEditor.scale;
        const imgBottom = imageEditor.offsetY + imageEditor.imageHeight * imageEditor.scale;
        
        if (x > imgRight - 10 && x < imgRight + 10 && y > imgBottom - 10 && y < imgBottom + 10) {
          canvas.style.cursor = 'nw-resize';
        } else {
          canvas.style.cursor = 'grab';
        }
      }
    });
    
    canvas.addEventListener('mouseup', () => {
      imageEditor.isDragging = false;
      imageEditor.isResizing = false;
      canvas.style.cursor = 'grab';
    });
    
    // Touch events для мобильных
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!imageEditor.image) return;
      
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      imageEditor.isDragging = true;
      imageEditor.lastX = touch.clientX - rect.left;
      imageEditor.lastY = touch.clientY - rect.top;
    });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!imageEditor.isDragging || !imageEditor.image) return;
      
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      imageEditor.offsetX += x - imageEditor.lastX;
      imageEditor.offsetY += y - imageEditor.lastY;
      
      imageEditor.lastX = x;
      imageEditor.lastY = y;
      
      redrawCanvas();
      updatePreview();
    });
    
    canvas.addEventListener('touchend', () => {
      imageEditor.isDragging = false;
    });
    
    // Pinch to zoom для мобильных
    let lastTouchDistance = 0;
    
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
      }
    });
    
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && imageEditor.image) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        if (lastTouchDistance > 0) {
          const scaleFactor = currentDistance / lastTouchDistance;
          imageEditor.scale *= scaleFactor;
          imageEditor.scale = Math.max(0.1, Math.min(imageEditor.scale, 5));
          
          redrawCanvas();
          updatePreview();
        }
        
        lastTouchDistance = currentDistance;
      }
    });
  }

  function fitImageToCanvas() {
    if (!imageEditor.image) return;
    
    const canvas = imageEditor.canvas;
    const img = imageEditor.image;
    
    const scaleX = canvas.width / img.width;
    const scaleY = canvas.height / img.height;
    imageEditor.scale = Math.min(scaleX, scaleY);
    
    imageEditor.offsetX = (canvas.width - img.width * imageEditor.scale) / 2;
    imageEditor.offsetY = (canvas.height - img.height * imageEditor.scale) / 2;
  }

  function redrawCanvas() {
    if (!imageEditor) return;
    
    const canvas = imageEditor.canvas;
    const ctx = imageEditor.ctx;
    
    // Очищаем
    ctx.fillStyle = '#2A3D5A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Рисуем изображение
    if (imageEditor.image) {
      ctx.save();
      ctx.drawImage(
        imageEditor.image,
        imageEditor.offsetX,
        imageEditor.offsetY,
        imageEditor.imageWidth * imageEditor.scale,
        imageEditor.imageHeight * imageEditor.scale
      );
      ctx.restore();
      
      // Рисуем ручку изменения размера
      const imgRight = imageEditor.offsetX + imageEditor.imageWidth * imageEditor.scale;
      const imgBottom = imageEditor.offsetY + imageEditor.imageHeight * imageEditor.scale;
      
      ctx.fillStyle = '#00D4FF';
      ctx.fillRect(imgRight - 5, imgBottom - 5, 10, 10);
    }
    
    // Рисуем сетку поверх изображения
    drawGrid(ctx, canvas.width, canvas.height);
  }

  function sliceImageToPixels() {
    if (!imageEditor || !imageEditor.image) {
      alert('Сначала загрузите изображение');
      return;
    }
    
    const canvas = imageEditor.canvas;
    const cols = Math.max(...selectedPixelsForImage.map(id => id % gridSize)) - Math.min(...selectedPixelsForImage.map(id => id % gridSize)) + 1;
    const rows = Math.max(...selectedPixelsForImage.map(id => Math.floor(id / gridSize))) - Math.min(...selectedPixelsForImage.map(id => Math.floor(id / gridSize))) + 1;
    
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;
    
    // Создаем временный canvas для нарезки
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = cellWidth;
    tempCanvas.height = cellHeight;
    
    const minRow = Math.min(...selectedPixelsForImage.map(id => Math.floor(id / gridSize)));
    const minCol = Math.min(...selectedPixelsForImage.map(id => id % gridSize));
    
    selectedPixelsForImage.forEach(pixelId => {
      const row = Math.floor(pixelId / gridSize) - minRow;
      const col = (pixelId % gridSize) - minCol;
      
      // Очищаем временный canvas
      tempCtx.clearRect(0, 0, cellWidth, cellHeight);
      
      // Копируем часть основного canvas
      tempCtx.drawImage(
        canvas,
        col * cellWidth, row * cellHeight, cellWidth, cellHeight,
        0, 0, cellWidth, cellHeight
      );
      
      // Получаем base64 данные
      const imageData = tempCanvas.toDataURL('image/png');
      
      // Сохраняем в pixelData
      if (!pixelData[pixelId]) pixelData[pixelId] = {};
      pixelData[pixelId].content = imageData;
      
      // Применяем к пикселю на странице
      const pixel = document.querySelector(`.pixel[data-id='${pixelId}']`);
      if (pixel) {
        pixel.style.backgroundImage = `url(${imageData})`;
        pixel.style.backgroundSize = 'cover';
        pixel.style.backgroundPosition = 'center';
        pixel.classList.add('custom');
      }
    });
    
    localStorage.setItem('pixelData', JSON.stringify(pixelData));
    document.getElementById('image-editor-modal').classList.add('hidden');
    alert(`Изображение успешно применено к ${selectedPixelsForImage.length} пикселям!`);
  }
  function getNeighbors(id) {
    const row = Math.floor(id / gridSize);
    const col = id % gridSize;
    const neighbors = [];
    
    // Проверяем 4 соседа (верх, низ, лево, право)
    if (row > 0) neighbors.push((row - 1) * gridSize + col); // верх
    if (row < gridSize - 1) neighbors.push((row + 1) * gridSize + col); // низ
    if (col > 0) neighbors.push(row * gridSize + (col - 1)); // лево
    if (col < gridSize - 1) neighbors.push(row * gridSize + (col + 1)); // право
    
    return neighbors;
  }

  function getOwnerNeighbors(id, owner) {
    return getNeighbors(id).filter(neighborId => {
      const neighborData = pixelData[neighborId];
      return neighborData && neighborData.owner === owner;
    });
  }

  function createOrUpdateGroup(pixelIds, owner) {
    // Находим минимальный ID для использования как ключ группы
    const groupId = Math.min(...pixelIds);
    
    if (!pixelGroups[groupId]) {
      pixelGroups[groupId] = {
        id: groupId,
        pixels: [],
        owner: owner,
        merged: false,
        createdAt: new Date().toISOString()
      };
    }
    
    pixelGroups[groupId].pixels = [...new Set([...pixelGroups[groupId].pixels, ...pixelIds])];
    
    // Автоматически объединяем если больше одного пикселя
    if (pixelGroups[groupId].pixels.length > 1) {
      pixelGroups[groupId].merged = true;
    }
    
    localStorage.setItem('pixelGroups', JSON.stringify(pixelGroups));
    
    return groupId;
  }

  function applyOwnerGroupStyling(pixelIds, owner) {
    pixelIds.forEach(pixelId => {
      const pixel = document.querySelector(`.pixel[data-id='${pixelId}']`);
      if (pixel) {
        pixel.classList.add('owner-group');
        if (pixelIds.length > 1) {
          pixel.classList.add('unified-area');
        }
      }
    });
  }

  function mergePixelGroup(groupId) {
    if (!pixelGroups[groupId]) return;
    
    const group = pixelGroups[groupId];
    group.merged = true;
    
    // Применяем стили объединения
    group.pixels.forEach(pixelId => {
      const pixel = document.querySelector(`.pixel[data-id='${pixelId}']`);
      if (pixel) {
        pixel.classList.add('merged', 'unified-area');
      }
    });
    
    // Убираем внутренние границы
    removeInternalBorders(group.pixels);
    
    // Если есть изображение, растягиваем его на всю группу
    const mainPixelData = pixelData[groupId];
    if (mainPixelData && mainPixelData.content) {
      applyImageToGroup(groupId, mainPixelData.content);
    }
    
    localStorage.setItem('pixelGroups', JSON.stringify(pixelGroups));
  }

  function removeInternalBorders(pixelIds) {
    pixelIds.forEach(pixelId => {
      const pixel = document.querySelector(`.pixel[data-id='${pixelId}']`);
      if (pixel) {
        const neighbors = getNeighbors(pixelId);
        const sameOwnerNeighbors = neighbors.filter(nId => pixelIds.includes(nId));
        
        if (sameOwnerNeighbors.length > 0) {
          // Убираем все внутренние границы
          pixel.style.boxShadow = 'none';
          pixel.style.border = 'none';
        }
      }
    });
    
    // Добавляем внешние границы только по периметру группы
    addGroupBorder(pixelIds);
  }

  function addGroupBorder(pixelIds) {
    const borderPixels = new Set();
    
    pixelIds.forEach(pixelId => {
      const neighbors = getNeighbors(pixelId);
      const hasExternalNeighbor = neighbors.some(nId => !pixelIds.includes(nId));
      
      if (hasExternalNeighbor) {
        borderPixels.add(pixelId);
      }
    });
    
    // Применяем границу только к внешним пикселям группы
    borderPixels.forEach(pixelId => {
      const pixel = document.querySelector(`.pixel[data-id='${pixelId}']`);
      if (pixel) {
        pixel.style.boxShadow = '0 0 0 0.1px rgba(0, 212, 255, 1)';
      }
    });
  }

  function mergePixelGroup(groupId) {
    if (!pixelGroups[groupId]) return;
    
    const group = pixelGroups[groupId];
    group.merged = true;
    
    // Убираем границы между пикселями группы
    group.pixels.forEach(pixelId => {
      const pixel = document.querySelector(`.pixel[data-id='${pixelId}']`);
      if (pixel) {
        pixel.classList.add('merged');
        updatePixelBorders(pixelId);
      }
    });
    
    // Если есть изображение, растягиваем его на всю группу
    const mainPixelData = pixelData[groupId];
    if (mainPixelData && mainPixelData.content) {
      applyImageToGroup(groupId, mainPixelData.content);
    }
    
    localStorage.setItem('pixelGroups', JSON.stringify(pixelGroups));
  }

  function updatePixelBorders(pixelId) {
    const pixel = document.querySelector(`.pixel[data-id='${pixelId}']`);
    if (!pixel) return;
    
    const pixelOwner = pixelData[pixelId]?.owner;
    if (!pixelOwner) return;
    
    const neighbors = getNeighbors(pixelId);
    const borders = ['top', 'right', 'bottom', 'left'];
    
    neighbors.forEach((neighborId, index) => {
      const neighborOwner = pixelData[neighborId]?.owner;
      const border = borders[index];
      
      if (neighborOwner === pixelOwner) {
        // Убираем границу со стороны соседа того же владельца
        pixel.style[`border-${border}`] = 'none';
      } else {
        // Восстанавливаем границу с другими владельцами
        pixel.style[`border-${border}`] = '0.5px solid #00D4FF';
      }
    });
  }

  function applyImageToGroup(groupId, imageUrl) {
    const group = pixelGroups[groupId];
    if (!group || !group.merged) return;
    
    // Вычисляем размеры группы
    const pixels = group.pixels;
    const rows = pixels.map(id => Math.floor(id / gridSize));
    const cols = pixels.map(id => id % gridSize);
    
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    
    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    
    // Применяем изображение к каждому пикселю группы
    pixels.forEach(pixelId => {
      const pixel = document.querySelector(`.pixel[data-id='${pixelId}']`);
      if (pixel) {
        const row = Math.floor(pixelId / gridSize);
        const col = pixelId % gridSize;
        
        const offsetX = ((col - minCol) / width) * 100;
        const offsetY = ((row - minRow) / height) * 100;
        
        pixel.style.backgroundImage = `url(${imageUrl})`;
        pixel.style.backgroundSize = `${width * 100}% ${height * 100}%`;
        pixel.style.backgroundPosition = `-${offsetX}% -${offsetY}%`;
        pixel.classList.add('custom');
      }
    });
  }

  function checkMergeOpportunities(pixelId, owner) {
    const neighbors = getOwnerNeighbors(pixelId, owner);
    
    if (neighbors.length > 0) {
      // Показываем предложение объединения
      const extraCost = Math.round(defaultPrice * mergePrice);
      return {
        canMerge: true,
        neighbors: neighbors.length,
        cost: extraCost,
        message: `Объединить с ${neighbors.length} соседними блоками за +${extraCost} TON?`
      };
    }
    
    return { canMerge: false };
  }

  function updateTransform() {
    if (grid && wrapper) {
      grid.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
    }
  }

  // Перемещение
  wrapper.addEventListener("mousedown", e => {
    isDragging = true;
    dragStart = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  });

  window.addEventListener("mouseup", () => isDragging = false);
  window.addEventListener("mousemove", e => {
    if (isDragging) {
      offset.x = e.clientX - dragStart.x;
      offset.y = e.clientY - dragStart.y;
      updateTransform();
    }
  });

  // Тач-перемещение
  wrapper.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
      isDragging = true;
      dragStart = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y };
    }
  });

  wrapper.addEventListener("touchmove", e => {
    if (isDragging && e.touches.length === 1) {
      offset.x = e.touches[0].clientX - dragStart.x;
      offset.y = e.touches[0].clientY - dragStart.y;
      updateTransform();
    }
  });

  wrapper.addEventListener("touchend", () => isDragging = false);

  // Зум с колеса мыши
  wrapper.addEventListener("wheel", e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.min(Math.max(scale + delta, 0.5), 5);
    updateTransform();
  });

  // Зум кнопками
  document.getElementById('zoom-in').onclick = () => {
    scale = Math.min(scale + 0.1, 5);
    updateTransform();
  };

  document.getElementById('zoom-out').onclick = () => {
    scale = Math.max(scale - 0.1, 0.5);
    updateTransform();
  };

  function closeAllModals() {
    document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
    document.getElementById("purchase-username").value = "";
    document.getElementById("confirm-username").value = "";
  }

  function calculateTotal(ids) {
    return ids.reduce((sum, id) => sum + ((pixelData[id]?.salePrice) || defaultPrice), 0);
  }

  function showMassActionModal(type) {
    if (selectedPixels.length === 0) return alert("Выделите блоки.");
    const total = calculateTotal(selectedPixels);
    document.getElementById("confirm-message").textContent = `${type === 'buy' ? 'Купить' : 'Подарить'} ${selectedPixels.length} блоков?`;
    document.getElementById("confirm-price").textContent = `Общая цена: ${total} TON`;
    document.getElementById("confirm-username").style.display = type === 'gift' ? "block" : "none";
    document.getElementById("confirm-modal").dataset.mode = type;
    document.getElementById("confirm-modal").classList.remove("hidden");
  }

  // Рендеринг сетки
  if (grid) {
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 10px)`;
    grid.style.gridTemplateRows = `repeat(${gridSize}, 10px)`;
    grid.style.gap = "1px";
    grid.style.width = "549px";
    grid.style.height = "549px";
    grid.style.border = "0.5px solid #00D4FF";
    grid.style.background = "rgba(0, 0, 0, 0.7)";

    for (let i = 0; i < total; i++) {
      const pixel = document.createElement("div");
      pixel.classList.add("pixel");
      pixel.dataset.id = i;
      if (savedTaken.includes(i)) {
        pixel.classList.add("taken");
        updatePixelBorders(i); // Обновляем boundaries для существующих пикселей
      }
      
      pixel.addEventListener('dblclick', () => {
        const id = parseInt(pixel.dataset.id);
        if (!pixel.classList.contains('taken')) {
          focusedPixel = id;
          const data = pixelData[id] || { id, salePrice: defaultPrice };
          pixelData[id] = data;
          
          document.getElementById('purchase-id').textContent = id;
          document.getElementById('purchase-price').textContent = data.salePrice;
          
          document.getElementById('purchase-modal').classList.remove('hidden');
        } else {
          // Если пиксель уже куплен, открываем редактор изображения для него
          openImageEditor([id]);
        }
      });
      
      pixel.addEventListener('click', () => {
        const id = parseInt(pixel.dataset.id);
        if (selectionMode) {
          if (pixel.classList.contains('taken')) return;
          if (selectedPixels.includes(id)) {
            selectedPixels = selectedPixels.filter(x => x !== id);
            pixel.classList.remove('selected');
          } else {
            selectedPixels.push(id);
            pixel.classList.add('selected');
          }
          return;
        }
        if (pixel.classList.contains('taken')) {
          const data = pixelData[id] || {};
          document.getElementById('view-id').textContent = id;
          document.getElementById('view-owner').textContent = data.owner || '?';
          document.getElementById('view-owner').href = data.link || '#';
          document.getElementById('view-category').textContent = data.category || 'Не указана';
          document.getElementById('view-date').textContent = data.date || '?';
          document.getElementById('view-price').textContent = data.salePrice || defaultPrice;
          document.getElementById('view-price-wrap').classList.remove('hidden');
          
          // Показываем информацию о группе если пиксель в группе
          const groupInfo = Object.values(pixelGroups).find(group => group.pixels.includes(id));
          const groupInfoElement = document.getElementById('group-info');
          if (groupInfo && groupInfo.merged) {
            groupInfoElement.style.display = 'block';
            groupInfoElement.textContent = `Часть группы из ${groupInfo.pixels.length} блоков`;
          } else {
            groupInfoElement.style.display = 'none';
          }
          
          document.getElementById('view-modal').classList.remove('hidden');
        } else {
          document.querySelectorAll('.pixel').forEach(p => p.classList.remove('selected'));
          pixel.classList.add('selected');
        }
      });
      grid.appendChild(pixel);
    }
    updateTransform(); // Применяем начальное выравнивание
  }

  document.getElementById('select-mode-btn').onclick = () => {
    selectionMode = !selectionMode;
    document.getElementById('select-mode-btn').textContent = `Выделение: ${selectionMode ? 'вкл' : 'выкл'}`;
  };

  document.getElementById('clear-selection-btn').onclick = () => {
    selectedPixels.forEach(id => {
      const p = document.querySelector(`.pixel[data-id='${id}']`);
      if (p) p.classList.remove('selected');
    });
    selectedPixels = [];
  };

  document.getElementById('buy-selected-btn').onclick = () => showMassActionModal('buy');
  document.getElementById('gift-selected-btn').onclick = () => showMassActionModal('gift');
  document.getElementById('edit-image-btn').onclick = () => {
    if (selectedPixels.length === 0) return alert("Выделите блоки для редактирования изображения.");
    openImageEditor(selectedPixels);
  };

  document.getElementById('edit-single-pixel').onclick = () => {
    const id = parseInt(document.getElementById('view-id').textContent);
    closeAllModals();
    openImageEditor([id]);
  };

  document.getElementById('confirm-yes').onclick = async () => {
    const mode = document.getElementById('confirm-modal').dataset.mode;
    const username = document.getElementById('confirm-username').value.trim() || defaultOwner;
    if (mode === 'gift' && (!username.startsWith('@') || username.length < 2)) {
      alert('Введите корректный @username или @channel.');
      return;
    }
    const now = new Date().toLocaleString();
    const owner = mode === 'gift' ? username : defaultOwner;
    
    // Покупаем каждый пиксель по очереди
    for (const id of selectedPixels) {
      if (!savedTaken.includes(id)) {
        await buyPixel(id);
        const pixel = document.querySelector(`.pixel[data-id='${id}']`);
        if (pixel) {
          pixel.classList.add('taken');
          pixel.classList.add('star-explosion');
          setTimeout(() => pixel.classList.remove('star-explosion'), 800);
        }
      }
      pixelData[id] = {
        ...pixelData[id],
        taken: true,
        owner: owner,
        link: mode === 'gift' ? `https://t.me/${username.slice(1)}` : 'https://t.me/NFTZONIX',
        category: pixelData[id]?.category || '—',
        date: now
      };
    }
    
    // Применяем общую подсветку для группы
    if (selectedPixels.length >= 1) {
      applyOwnerGroupStyling(selectedPixels, owner);
    }
    
    // Создаем группу и автоматически объединяем если больше одного пикселя
    if (selectedPixels.length > 1) {
      const groupId = createOrUpdateGroup(selectedPixels, owner);
      
      // Небольшая задержка для красивой анимации
      setTimeout(() => {
        mergePixelGroup(groupId);
      }, 1000);
    }
    
    localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
    localStorage.setItem('pixelData', JSON.stringify(pixelData));
    
    // Очищаем выделение
    selectedPixels.forEach(id => {
      const p = document.querySelector(`.pixel[data-id='${id}']`);
      if (p) p.classList.remove('selected');
    });
    
    const pixelCount = selectedPixels.length;
    selectedPixels = [];
    closeAllModals();
    
    // Показываем сообщение о возможности загрузки изображения
    alert(`🎉 ${pixelCount} ${pixelCount === 1 ? 'пиксель куплен' : 'пикселей куплено'}! Теперь вы можете загрузить картинку в купленные пиксели через кнопку "Редактор изображения".`);
  };

  document.getElementById('confirm-no').onclick = closeAllModals;
  document.getElementById('confirm-close').onclick = closeAllModals;
  document.getElementById('purchase-close').onclick = closeAllModals;
  document.getElementById('view-close').onclick = closeAllModals;
  document.getElementById('editor-close').onclick = closeAllModals;
  document.getElementById('editor-save').onclick = sliceImageToPixels;
  document.getElementById('editor-reset').onclick = () => {
    if (imageEditor && imageEditor.image) {
      // Сбрасываем к оригинальному размеру
      imageEditor.scale = 1;
      imageEditor.offsetX = (imageEditor.canvas.width - imageEditor.imageWidth) / 2;
      imageEditor.offsetY = (imageEditor.canvas.height - imageEditor.imageHeight) / 2;
      redrawCanvas();
      updatePreview();
    }
  };

  document.getElementById('purchase-self').onclick = async () => {
    const id = parseInt(document.getElementById('purchase-id').textContent);
    const category = document.getElementById('category-select').value;
    const fileInput = document.getElementById('pixel-image');
    const shouldMerge = document.getElementById('merge-checkbox')?.checked || false;
    const owner = tonConnectUI.wallet?.account.address || defaultOwner;
    
    let imageUrl = pixelData[id]?.content || '';
    if (fileInput.files[0]) {
      imageUrl = URL.createObjectURL(fileInput.files[0]);
    }
    
    // Рассчитываем цену с учетом объединения
    let totalPrice = pixelData[id]?.salePrice || defaultPrice;
    if (shouldMerge) {
      const mergeOpp = checkMergeOpportunities(id, owner);
      if (mergeOpp.canMerge) {
        totalPrice += mergeOpp.cost;
      }
    }
    
    await buyPixel(id, totalPrice);
    const pixel = document.querySelector(`.pixel[data-id='${id}']`);
    if (pixel) {
      pixel.classList.add('star-explosion');
      setTimeout(() => pixel.classList.remove('star-explosion'), 800);
    }
    
    pixelData[id] = {
      ...pixelData[id],
      category: category,
      content: imageUrl,
      taken: true,
      owner: owner,
      date: new Date().toLocaleString()
    };
    
    // Обрабатываем объединение
    if (shouldMerge) {
      const neighbors = getOwnerNeighbors(id, owner);
      const allPixels = [id, ...neighbors];
      const groupId = createOrUpdateGroup(allPixels, owner);
      
      setTimeout(() => {
        mergePixelGroup(groupId);
        if (imageUrl) {
          applyImageToGroup(groupId, imageUrl);
        }
      }, 1000);
    } else if (imageUrl) {
      // Применяем изображение только к одному пикселю
      pixel.style.backgroundImage = `url(${imageUrl})`;
      pixel.classList.add('custom');
    }
    
    // Обновляем границы
    updatePixelBorders(id);
    getNeighbors(id).forEach(neighborId => updatePixelBorders(neighborId));
    
    localStorage.setItem('pixelData', JSON.stringify(pixelData));
    closeAllModals();
  };

  document.getElementById('purchase-gift').onclick = () => {
    document.getElementById('purchase-username').style.display = 'block';
    document.getElementById('gift-actions').style.display = 'flex';
  };
  
  document.getElementById('cancel-gift').onclick = closeAllModals;
  
  document.getElementById('confirm-gift').onclick = async () => {
    const username = document.getElementById('purchase-username').value.trim() || defaultOwner;
    const category = document.getElementById('category-select').value;
    const id = parseInt(document.getElementById('purchase-id').textContent);
    const now = new Date().toLocaleString();
    
    if (!username.startsWith('@') || username.length < 2) {
      alert('Введите корректный @username или @channel.');
      return;
    }
    
    if (!savedTaken.includes(id)) {
      await buyPixel(id);
      const pixel = document.querySelector(`.pixel[data-id='${id}']`);
      if (pixel) {
        pixel.classList.add('taken', 'owner-group');
        pixel.classList.add('star-explosion');
        setTimeout(() => pixel.classList.remove('star-explosion'), 800);
      }
    }
    
    pixelData[id] = {
      ...pixelData[id],
      taken: true,
      owner: username,
      link: `https://t.me/${username.slice(1)}`,
      category: category,
      date: now
    };
    
    // Проверяем соседние пиксели для автоматического объединения
    const neighbors = getOwnerNeighbors(id, username);
    if (neighbors.length > 0) {
      const allPixels = [id, ...neighbors];
      const groupId = createOrUpdateGroup(allPixels, username);
      
      setTimeout(() => {
        mergePixelGroup(groupId);
      }, 1000);
    }
    
    localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
    localStorage.setItem('pixelData', JSON.stringify(pixelData));
    alert(`Блок #${id} подарен ${username}`);
    closeAllModals();
  };

  async function buyPixel(id, customPrice = null) {
    if (!tonConnectUI.wallet) return alert('Connect wallet!');
    const price = customPrice || (pixelData[id]?.salePrice || defaultPrice);
    const transaction = {
      messages: [{
        address: 'YOUR_CONTRACT_ADDRESS',
        amount: price * 1e9,
        payload: `buy:${id}`
      }]
    };
    try {
      await tonConnectUI.sendTransaction(transaction);
      if (!savedTaken.includes(id)) savedTaken.push(id);
      const pixel = document.querySelector(`.pixel[data-id='${id}']`);
      if (pixel) {
        pixel.classList.add('taken');
      }
      pixelData[id] = {
        ...pixelData[id],
        taken: true,
        owner: tonConnectUI.wallet.account.address,
        date: new Date().toLocaleString()
      };
      localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
      localStorage.setItem('pixelData', JSON.stringify(pixelData));
    } catch (error) {
      console.error('Transaction failed:', error);
      alert('Ошибка при покупке!');
    }
  }

  function sellPixel(id) {
    const pixel = document.querySelector(`.pixel[data-id='${id}']`);
    if (pixel) {
      pixel.classList.add('neon-fade');
      setTimeout(() => {
        pixel.classList.remove('taken', 'neon-fade', 'custom', 'merged');
        pixel.style.backgroundImage = '';
        pixel.style.backgroundSize = '';
        pixel.style.backgroundPosition = '';
        pixel.style.border = '';
        
        // Удаляем из групп
        Object.keys(pixelGroups).forEach(groupId => {
          const group = pixelGroups[groupId];
          if (group.pixels.includes(id)) {
            group.pixels = group.pixels.filter(pixelId => pixelId !== id);
            if (group.pixels.length === 0) {
              delete pixelGroups[groupId];
            }
          }
        });
        
        delete pixelData[id];
        localStorage.setItem('pixelData', JSON.stringify(pixelData));
        localStorage.setItem('pixelGroups', JSON.stringify(pixelGroups));
        savedTaken = savedTaken.filter(x => x !== id);
        localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
        
        // Обновляем границы соседей
        getNeighbors(id).forEach(neighborId => updatePixelBorders(neighborId));
      }, 800);
    }
  }

  document.getElementById('sell-pixel').onclick = () => {
    const id = parseInt(document.getElementById('view-id').textContent);
    if (pixelData[id]?.owner === tonConnectUI.wallet?.account.address) {
      sellPixel(id);
      closeAllModals();
    } else {
      alert('Вы не владелец этого блока!');
    }
  };

  document.getElementById('filter-category').onchange = (e) => {
    const category = e.target.value;
    document.querySelectorAll('.pixel').forEach(p => {
      const id = parseInt(p.dataset.id);
      const matches = category === '' || pixelData[id]?.category === category;
      p.style.opacity = matches ? '1' : '0.3';
      p.style.filter = matches ? 'none' : 'grayscale(100%)';
    });
  };

  // Инициализация: восстанавливаем группы после загрузки
  setTimeout(() => {
    Object.keys(pixelGroups).forEach(groupId => {
      const group = pixelGroups[groupId];
      if (group.merged) {
        group.pixels.forEach(pixelId => {
          updatePixelBorders(pixelId);
        });
        
        const mainPixelData = pixelData[groupId];
        if (mainPixelData && mainPixelData.content) {
          applyImageToGroup(parseInt(groupId), mainPixelData.content);
        }
      }
    });
  }, 100);
});