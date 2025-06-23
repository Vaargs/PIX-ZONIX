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

  const tonConnectUI = window.TONConnectUI ? new TONConnectUI({
    manifestUrl: 'https://nft-zonix.vercel.app/tonconnect-manifest.json'
  }) : { connectWallet: () => console.log('TON Wallet mock'), onStatusChange: () => {} };
  document.getElementById('connect-ton').onclick = () => tonConnectUI.connectWallet();
  tonConnectUI.onStatusChange(wallet => {
    if (wallet) console.log('Wallet connected:', wallet.account.address);
  });

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
      if (savedTaken.includes(i)) pixel.classList.add("taken");
      pixel.addEventListener('dblclick', () => {
        const id = parseInt(pixel.dataset.id);
        if (!pixel.classList.contains('taken')) {
          focusedPixel = id;
          const data = pixelData[id] || { id, salePrice: defaultPrice };
          pixelData[id] = data;
          document.getElementById('purchase-id').textContent = id;
          document.getElementById('purchase-price').textContent = data.salePrice;
          document.getElementById('purchase-modal').classList.remove('hidden');
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
          pixel.classList.add('star-explosion');
          setTimeout(() => pixel.classList.remove('star-explosion'), 800);
        }
      }
      pixelData[id] = {
        ...pixelData[id],
        taken: true,
        owner: mode === 'gift' ? username : tonConnectUI.wallet.account.address,
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
    const fileInput = document.getElementById('pixel-image');
    let imageUrl = pixelData[id]?.content || '';
    if (fileInput.files[0]) {
      imageUrl = URL.createObjectURL(fileInput.files[0]);
      document.querySelector(`.pixel[data-id='${id}']`).style.backgroundImage = `url(${imageUrl})`;
      document.querySelector(`.pixel[data-id='${id}']`).classList.add('custom');
    }
    await buyPixel(id);
    const pixel = document.querySelector(`.pixel[data-id='${id}']`);
    if (pixel) {
      pixel.classList.add('star-explosion');
      setTimeout(() => pixel.classList.remove('star-explosion'), 800);
    }
    pixelData[id] = {
      ...pixelData[id],
      category: category,
      content: imageUrl
    };
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
    localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
    localStorage.setItem('pixelData', JSON.stringify(pixelData));
    alert(`Блок #${id} подарен ${username}`);
    closeAllModals();
  };

  async function buyPixel(id) {
    if (!tonConnectUI.wallet) return alert('Connect wallet!');
    const transaction = {
      messages: [{
        address: 'YOUR_CONTRACT_ADDRESS',
        amount: (pixelData[id]?.salePrice || defaultPrice) * 1e9,
        payload: `buy:${id}`
      }]
    };
    try {
      await tonConnectUI.sendTransaction(transaction);
      if (!savedTaken.includes(id)) savedTaken.push(id);
      const pixel = document.querySelector(`.pixel[data-id='${id}']`);
      if (pixel) {
        pixel.classList.add('star-explosion');
        setTimeout(() => pixel.classList.remove('star-explosion'), 800);
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
        pixel.classList.remove('taken', 'neon-fade', 'custom');
        pixel.style.backgroundImage = '';
        delete pixelData[id];
        localStorage.setItem('pixelData', JSON.stringify(pixelData));
        savedTaken = savedTaken.filter(x => x !== id);
        localStorage.setItem('takenPixels', JSON.stringify(savedTaken));
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
});