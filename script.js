document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById("pixel-grid");
  const wrapper = document.getElementById("pixel-wrapper");
  const gridSize = 50;
  const total = gridSize * gridSize;

  let savedTaken = JSON.parse(localStorage.getItem("takenPixels")) || [];
  let pixelData = JSON.parse(localStorage.getItem("pixelData")) || {};
  let selectionMode = false;
  let selectedPixels = [];
  let scale = 1;
  let offset = { x: 0, y: 0 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  const defaultPrice = 35;
  const telegram = window.Telegram?.WebApp || { ready: () => {}, initDataUnsafe: { user: null } };
  telegram.ready();
  const user = telegram.initDataUnsafe?.user;
  const defaultOwner = user ? `@${user.username}` : '@you';

  Object.keys(pixelData).forEach(id => {
    if (pixelData[id].content && pixelData[id].content.startsWith('blob:')) {
      delete pixelData[id].content;
    }
  });
  localStorage.setItem('pixelData', JSON.stringify(pixelData));

  function updateTransform() {
    if (grid && wrapper) {
      grid.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
    }
  }

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

  wrapper.addEventListener("wheel", e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.min(Math.max(scale + delta, 0.5), 5);
    updateTransform();
  });

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
    if (editorCanvas) {
      editorCanvas.clear();
      editorCanvas.dispose();
      editorCanvas = null;
    }
  }

  function calculateTotal(ids) {
    return ids.reduce((sum, id) => sum + (pixelData[id]?.salePrice || defaultPrice), 0);
  }

  function showPurchaseModal(id) {
    document.getElementById("purchase-id").textContent = id;
    document.getElementById("purchase-price").textContent = pixelData[id]?.salePrice || defaultPrice;
    document.getElementById("purchase-modal").classList.remove("hidden");
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
      if (savedTaken.includes(i)) pixel.classList.add("taken");
      if (pixelData[i]?.content) {
        pixel.style.backgroundImage = `url(${pixelData[i].content})`;
        pixel.classList.add('custom');
      }
      pixel.addEventListener('click', () => {
        const id = parseInt(pixel.dataset.id);
        if (pixel.classList.contains('taken')) {
          const data = pixelData[id] || {};
          document.getElementById('view-id').textContent = id;
          document.getElementById('view-owner').textContent = data.owner || '?';
          document.getElementById('view-owner').href = data.link || '#';
          document.getElementById('view-category').textContent = data.category || 'Не указана';
          document.getElementById('view-date').textContent = data.date || '?';
          document.getElementById('view-price').textContent = data.salePrice || defaultPrice;
          document.getElementById('view-price-wrap').classList.remove('hidden');
          document.getElementById('view-modal').classList.remove("hidden");
          return;
        }
        if (selectionMode) {
          if (selectedPixels.includes(id)) {
            selectedPixels = selectedPixels.filter(x => x !== id);
            pixel.classList.remove('selected');
          } else {
            selectedPixels.push(id);
            pixel.classList.add('selected');
          }
        } else {
          if (selectedPixels.includes(id)) {
            selectedPixels = [id];
            openEditorModal();
          } else {
            document.querySelectorAll('.pixel').forEach(p => p.classList.remove('selected'));
            selectedPixels = [id];
            pixel.classList.add('selected');
          }
        }
      });
      grid.appendChild(pixel);
    }
    updateTransform();
  }

  document.getElementById('select-mode-btn').onclick = () => {
    selectionMode = !selectionMode;
    document.getElementById('select-mode-btn').textContent = `Выделение: ${selectionMode ? 'вкл' : 'выкл'}`;
    console.log('Selection mode:', selectionMode);
  };

  document.getElementById('clear-selection-btn').onclick = () => {
    selectedPixels.forEach(id => {
      const p = document.querySelector(`.pixel[data-id='${id}']`);
      if (p) p.classList.remove('selected');
    });
    selectedPixels = [];
    console.log('Selection cleared');
  };

  document.getElementById('buy-selected-btn').onclick = () => {
    if (selectedPixels.length === 0) return alert("Выделите блоки.");
    openEditorModal();
    console.log('Buy selected, pixels:', selectedPixels);
  };

  document.getElementById('gift-selected-btn').onclick = () => {
    showMassActionModal('gift');
    console.log('Gift selected, pixels:', selectedPixels);
  };

  document.getElementById('confirm-yes').onclick = async () => {
    const mode = document.getElementById('confirm-modal').dataset.mode;
    const username = document.getElementById('confirm-username').value.trim() || defaultOwner;
    if (mode === 'gift' && (!username.startsWith('@') || username.length < 2)) {
      alert('Введите корректный @username или @channel.');
      return;
    }
    const now = new Date().toLocaleString();
    for (const id of selectedPixels) {
      if (!savedTaken.includes(id)) {
        await buyPixel(id);
        const pixel = document.querySelector(`.pixel[data-id='${id}']`);
        if (pixel) {
          if (mode === 'gift') {
            pixel.classList.add('gift-box');
            for (let i = 0; i < 4; i++) {
              const confetti = document.createElement('div');
              confetti.classList.add('confetti');
              confetti.style.setProperty('--x', `${Math.random() * 20 - 10}px`);
              confetti.style.setProperty('--y', `${Math.random() * 20 - 10}px`);
              pixel.appendChild(confetti);
            }
            setTimeout(() => {
              pixel.classList.remove('gift-box');
              pixel.querySelectorAll('.confetti').forEach(c => c.remove());
            }, 1000);
          } else {
            pixel.classList.add('star-explosion');
            setTimeout(() => pixel.classList.remove('star-explosion'), 800);
          }
        }
      }
      pixelData[id] = {
        ...pixelData[id],
        taken: true,
        owner: mode === 'gift' ? username : defaultOwner,
        link: mode === 'gift' ? `https://t.me/${username.slice(1)}` : 'https://t.me/NFTZONIX',
        category: pixelData[id]?.category || '—',
        date: now
      };
    }
    localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
    localStorage.setItem('pixelData', JSON.stringify(pixelData));
    selectedPixels = [];
    closeAllModals();
  };

  document.getElementById('confirm-no').onclick = closeAllModals;
  document.getElementById('confirm-close').onclick = closeAllModals;
  document.getElementById('purchase-close').onclick = closeAllModals;
  document.getElementById('view-close').onclick = closeAllModals;

  document.getElementById('purchase-self').onclick = async () => {
    const id = parseInt(document.getElementById('purchase-id').textContent);
    const category = document.getElementById('category-select').value;
    pixelData[id] = { ...pixelData[id], category: category };
    await buyPixel(id);
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
        pixel.classList.add('gift-box');
        for (let i = 0; i < 4; i++) {
          const confetti = document.createElement('div');
          confetti.classList.add('confetti');
          confetti.style.setProperty('--x', `${Math.random() * 20 - 10}px`);
          confetti.style.setProperty('--y', `${Math.random() * 20 - 10}px`);
          pixel.appendChild(confetti);
        }
        setTimeout(() => {
          pixel.classList.remove('gift-box');
          pixel.querySelectorAll('.confetti').forEach(c => c.remove());
        }, 1000);
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
    localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
    localStorage.setItem('pixelData', JSON.stringify(pixelData));
    alert(`Блок #${id} подарен ${username}`);
    closeAllModals();
  };

  async function buyPixel(id) {
    if (!savedTaken.includes(id)) savedTaken.push(id);
    const pixel = document.querySelector(`.pixel[data-id='${id}']`);
    if (pixel) {
      pixel.classList.add('star-explosion');
      setTimeout(() => pixel.classList.remove('star-explosion'), 800);
    }
    pixelData[id] = {
      ...pixelData[id],
      taken: true,
      owner: defaultOwner,
      date: new Date().toLocaleString()
    };
    localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
    localStorage.setItem('pixelData', JSON.stringify(pixelData));
  }

  document.getElementById('sell-pixel').onclick = () => {
    const id = parseInt(document.getElementById('view-id').textContent);
    if (pixelData[id]?.owner === defaultOwner) {
      const pixel = document.querySelector(`.pixel[data-id='${id}']`);
      if (pixel) {
        pixel.classList.add('neon-fade');
        setTimeout(() => {
          pixel.classList.remove('taken', 'neon-fade', 'custom');
          pixel.style.backgroundImage = '';
          delete pixelData[id];
          localStorage.setItem('pixelData', JSON.stringify(pixelData));
          savedTaken = savedTaken.filter(x => x !== id);
          localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
        }, 800);
      }
      closeAllModals();
    } else {
      alert('Вы не владелец этого блока!');
    }
  };

  document.getElementById('filter-owner').onchange = (e) => {
    const owner = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.pixel').forEach(p => {
      const id = parseInt(p.dataset.id);
      const pixelOwner = pixelData[id]?.owner?.toLowerCase() || '';
      const matches = owner === '' || pixelOwner.includes(owner);
      p.style.opacity = matches ? '1' : '0.3';
      p.style.filter = matches ? 'none' : 'grayscale(100%)';
    });
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

  let editorCanvas = null;
  function openEditorModal() {
    if (selectedPixels.length === 0) return alert("Выделите блоки.");
    const minX = Math.min(...selectedPixels.map(id => id % gridSize));
    const maxX = Math.max(...selectedPixels.map(id => id % gridSize));
    const minY = Math.min(...selectedPixels.map(id => Math.floor(id / gridSize)));
    const maxY = Math.max(...selectedPixels.map(id => Math.floor(id / gridSize)));
    const width = (maxX - minX + 1) * 10;
    const height = (maxY - minY + 1) * 10;

    const canvasElement = document.getElementById('editor-canvas');
    canvasElement.width = width * 2;
    canvasElement.height = height * 2;
    canvasElement.style.width = `${width}px`;
    canvasElement.style.height = `${height}px`;

    editorCanvas = new fabric.Canvas('editor-canvas', {
      width: width * 2,
      height: height * 2,
      backgroundColor: '#444'
    });

    for (let x = 0; x <= width; x += 10) {
      editorCanvas.add(new fabric.Line([x * 2, 0, x * 2, height * 2], { stroke: '#00D4FF', selectable: false }));
    }
    for (let y = 0; y <= height; y += 10) {
      editorCanvas.add(new fabric.Line([0, y * 2, width * 2, y * 2], { stroke: '#00D4FF', selectable: false }));
    }

    document.getElementById('editor-image-upload').onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          fabric.Image.fromURL(event.target.result, (img) => {
            img.scaleToWidth(width * 2);
            img.set({ left: 0, top: 0, selectable: true, hasBorders: true });
            editorCanvas.add(img).setActiveObject(img);
            editorCanvas.renderAll();
          });
        };
        reader.readAsDataURL(file);
      }
    };

    document.getElementById('editor-save').onclick = () => {
      const img = editorCanvas.getObjects().find(obj => obj.type === 'image');
      if (!img) return alert('Загрузите изображение.');

      selectedPixels.forEach(id => {
        const x = (id % gridSize - minX) * 10 * 2;
        const y = (Math.floor(id / gridSize) - minY) * 10 * 2;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 20;
        tempCanvas.height = 20;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(
          editorCanvas.getElement(),
          x, y, 20, 20,
          0, 0, 20, 20
        );
        const base64 = tempCanvas.toDataURL('image/png');
        pixelData[id] = {
          ...pixelData[id],
          content: base64
        };
        const pixel = document.querySelector(`.pixel[data-id='${id}']`);
        if (pixel) {
          pixel.style.backgroundImage = `url(${base64})`;
          pixel.classList.add('custom');
        }
      });

      localStorage.setItem('pixelData', JSON.stringify(pixelData));
      closeAllModals();
      if (selectedPixels.length === 1) {
        showPurchaseModal(selectedPixels[0]);
      } else {
        showMassActionModal('buy');
      }
    };

    document.getElementById('editor-cancel').onclick = closeAllModals;
    document.getElementById('editor-modal').classList.remove('hidden');
  }
});