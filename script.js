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

  if (wrapper) {
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
  }

  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
    scale = Math.min(scale + 0.1, 5);
    updateTransform();
    console.log('Zoom in');
  });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
    scale = Math.max(scale - 0.1, 0.5);
    updateTransform();
    console.log('Zoom out');
  });

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
    const purchaseId = document.getElementById("purchase-id");
    const purchasePrice = document.getElementById("purchase-price");
    const purchaseModal = document.getElementById("purchase-modal");
    if (purchaseId && purchasePrice && purchaseModal) {
      purchaseId.textContent = id;
      purchasePrice.textContent = pixelData[id]?.salePrice || defaultPrice;
      purchaseModal.classList.remove("hidden");
      console.log('Purchase modal opened for pixel:', id);
    }
  }

  function showMassActionModal(type) {
    if (selectedPixels.length === 0) return alert("Выделите блоки.");
    const confirmMessage = document.getElementById("confirm-message");
    const confirmPrice = document.getElementById("confirm-price");
    const confirmUsername = document.getElementById("confirm-username");
    const confirmModal = document.getElementById("confirm-modal");
    if (confirmMessage && confirmPrice && confirmUsername && confirmModal) {
      const total = calculateTotal(selectedPixels);
      confirmMessage.textContent = `${type === 'buy' ? 'Купить' : 'Подарить'} ${selectedPixels.length} блоков?`;
      confirmPrice.textContent = `Общая цена: ${total} TON`;
      confirmUsername.style.display = type === 'gift' ? "block" : "none";
      confirmModal.dataset.mode = type;
      confirmModal.classList.remove("hidden");
      console.log(`Mass action modal opened: ${type}, pixels:`, selectedPixels);
    }
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
          const viewId = document.getElementById('view-id');
          const viewOwner = document.getElementById('view-owner');
          const viewCategory = document.getElementById('view-category');
          const viewDate = document.getElementById('view-date');
          const viewPrice = document.getElementById('view-price');
          const viewPriceWrap = document.getElementById('view-price-wrap');
          const viewModal = document.getElementById('view-modal');
          if (viewId && viewOwner && viewCategory && viewDate && viewPrice && viewPriceWrap && viewModal) {
            viewId.textContent = id;
            viewOwner.textContent = data.owner || '?';
            viewOwner.href = data.link || '#';
            viewCategory.textContent = data.category || 'Не указана';
            viewDate.textContent = data.date || '?';
            viewPrice.textContent = data.salePrice || defaultPrice;
            viewPriceWrap.classList.remove('hidden');
            viewModal.classList.remove("hidden");
            console.log('View modal opened for pixel:', id);
          }
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
        console.log('Pixel clicked, selected:', selectedPixels);
      });
      grid.appendChild(pixel);
    }
    updateTransform();
  }

  const selectModeBtn = document.getElementById('select-mode-btn');
  if (selectModeBtn) {
    selectModeBtn.addEventListener('click', () => {
      selectionMode = !selectionMode;
      selectModeBtn.textContent = `Выделение: ${selectionMode ? 'вкл' : 'выкл'}`;
      console.log('Selection mode toggled:', selectionMode);
    });
  }

  const clearSelectionBtn = document.getElementById('clear-selection-btn');
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => {
      selectedPixels.forEach(id => {
        const p = document.querySelector(`.pixel[data-id='${id}']`);
        if (p) p.classList.remove('selected');
      });
      selectedPixels = [];
      console.log('Selection cleared');
    });
  }

  const buySelectedBtn = document.getElementById('buy-selected-btn');
  if (buySelectedBtn) {
    buySelectedBtn.addEventListener('click', () => {
      if (selectedPixels.length === 0) {
        alert("Выделите блоки.");
        console.log('Buy selected clicked, no pixels selected');
        return;
      }
      openEditorModal();
      console.log('Buy selected clicked, pixels:', selectedPixels);
    });
  }

  const giftSelectedBtn = document.getElementById('gift-selected-btn');
  if (giftSelectedBtn) {
    giftSelectedBtn.addEventListener('click', () => {
      if (selectedPixels.length === 0) {
        alert("Выделите блоки.");
        console.log('Gift selected clicked, no pixels selected');
        return;
      }
      showMassActionModal('gift');
      console.log('Gift selected clicked, pixels:', selectedPixels);
    });
  }

  const confirmYesBtn = document.getElementById('confirm-yes');
  if (confirmYesBtn) {
    confirmYesBtn.addEventListener('click', async () => {
      const confirmModal = document.getElementById('confirm-modal');
      const confirmUsername = document.getElementById('confirm-username');
      if (!confirmModal || !confirmUsername) return;
      const mode = confirmModal.dataset.mode;
      const username = confirmUsername.value.trim() || defaultOwner;
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
      console.log(`Confirmed ${mode}, pixels:`, selectedPixels);
    });
  }

  const confirmNoBtn = document.getElementById('confirm-no');
  const confirmCloseBtn = document.getElementById('confirm-close');
  const purchaseCloseBtn = document.getElementById('purchase-close');
  const viewCloseBtn = document.getElementById('view-close');
  if (confirmNoBtn) confirmNoBtn.addEventListener('click', closeAllModals);
  if (confirmCloseBtn) confirmCloseBtn.addEventListener('click', closeAllModals);
  if (purchaseCloseBtn) purchaseCloseBtn.addEventListener('click', closeAllModals);
  if (viewCloseBtn) viewCloseBtn.addEventListener('click', closeAllModals);

  const purchaseSelfBtn = document.getElementById('purchase-self');
  if (purchaseSelfBtn) {
    purchaseSelfBtn.addEventListener('click', async () => {
      const purchaseId = document.getElementById('purchase-id');
      const categorySelect = document.getElementById('category-select');
      if (!purchaseId || !categorySelect) return;
      const id = parseInt(purchaseId.textContent);
      const category = categorySelect.value;
      pixelData[id] = { ...pixelData[id], category: category };
      await buyPixel(id);
      closeAllModals();
      console.log('Purchased pixel:', id);
    });
  }

  const purchaseGiftBtn = document.getElementById('purchase-gift');
  if (purchaseGiftBtn) {
    purchaseGiftBtn.addEventListener('click', () => {
      const purchaseUsername = document.getElementById('purchase-username');
      const giftActions = document.getElementById('gift-actions');
      if (purchaseUsername && giftActions) {
        purchaseUsername.style.display = 'block';
        giftActions.style.display = 'flex';
        console.log('Gift purchase initiated');
      }
    });
  }

  const cancelGiftBtn = document.getElementById('cancel-gift');
  if (cancelGiftBtn) cancelGiftBtn.addEventListener('click', closeAllModals);

  const confirmGiftBtn = document.getElementById('confirm-gift');
  if (confirmGiftBtn) {
    confirmGiftBtn.addEventListener('click', async () => {
      const purchaseUsername = document.getElementById('purchase-username');
      const categorySelect = document.getElementById('category-select');
      const purchaseId = document.getElementById('purchase-id');
      if (!purchaseUsername || !categorySelect || !purchaseId) return;
      const username = purchaseUsername.value.trim() || defaultOwner;
      const category = categorySelect.value;
      const id = parseInt(purchaseId.textContent);
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
      console.log('Gifted pixel:', id, 'to:', username);
    });
  }

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

  const sellPixelBtn = document.getElementById('sell-pixel');
  if (sellPixelBtn) {
    sellPixelBtn.addEventListener('click', () => {
      const viewId = document.getElementById('view-id');
      if (!viewId) return;
      const id = parseInt(viewId.textContent);
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
        console.log('Sold pixel:', id);
      } else {
        alert('Вы не владелец этого блока!');
      }
    });
  }

  const filterOwnerInput = document.getElementById('filter-owner');
  if (filterOwnerInput) {
    filterOwnerInput.addEventListener('input', (e) => {
      const owner = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.pixel').forEach(p => {
        const id = parseInt(p.dataset.id);
        const pixelOwner = pixelData[id]?.owner?.toLowerCase() || '';
        const matches = owner === '' || pixelOwner.includes(owner);
        p.style.opacity = matches ? '1' : '0.3';
        p.style.filter = matches ? 'none' : 'grayscale(100%)';
      });
      console.log('Owner filter applied:', owner);
    });
  }

  const filterCategorySelect = document.getElementById('filter-category');
  if (filterCategorySelect) {
    filterCategorySelect.addEventListener('change', (e) => {
      const category = e.target.value;
      document.querySelectorAll('.pixel').forEach(p => {
        const id = parseInt(p.dataset.id);
        const matches = category === '' || pixelData[id]?.category === category;
        p.style.opacity = matches ? '1' : '0.3';
        p.style.filter = matches ? 'none' : 'grayscale(100%)';
      });
      console.log('Category filter applied:', category);
    });
  }

  let editorCanvas = null;
  function openEditorModal() {
    if (selectedPixels.length === 0) {
      alert("Выделите блоки.");
      console.log('Editor modal attempted, no pixels selected');
      return;
    }
    const minX = Math.min(...selectedPixels.map(id => id % gridSize));
    const maxX = Math.max(...selectedPixels.map(id => id % gridSize));
    const minY = Math.min(...selectedPixels.map(id => Math.floor(id / gridSize)));
    const maxY = Math.max(...selectedPixels.map(id => Math.floor(id / gridSize)));
    const width = (maxX - minX + 1) * 10;
    const height = (maxY - minY + 1) * 10;

    const canvasElement = document.getElementById('editor-canvas');
    if (canvasElement) {
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

      const editorImageUpload = document.getElementById('editor-image-upload');
      if (editorImageUpload) {
        editorImageUpload.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              fabric.Image.fromURL(event.target.result, (img) => {
                img.scaleToWidth(width * 2);
                img.set({ left: 0, top: 0, selectable: true, hasBorders: true });
                editorCanvas.add(img).setActiveObject(img);
                editorCanvas.renderAll();
                console.log('Image loaded in editor');
              });
            };
            reader.readAsDataURL(file);
          }
        });
      }

      const editorSaveBtn = document.getElementById('editor-save');
      if (editorSaveBtn) {
        editorSaveBtn.addEventListener('click', () => {
          const img = editorCanvas.getObjects().find(obj => obj.type === 'image');
          if (!img) {
            alert('Загрузите изображение.');
            console.log('Editor save attempted, no image');
            return;
          }

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
          console.log('Editor saved, pixels:', selectedPixels);
        });
      }

      const editorCancelBtn = document.getElementById('editor-cancel');
      if (editorCancelBtn) editorCancelBtn.addEventListener('click', closeAllModals);

      const editorModal = document.getElementById('editor-modal');
      if (editorModal) {
        editorModal.classList.remove('hidden');
        console.log('Editor modal opened, pixels:', selectedPixels);
      }
    }
  }
});