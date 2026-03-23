// ─── CS2WeaponModder - Electron Desktop App ─────────────────────

(function () {
  'use strict';

  let weaponData = null;
  let currentKey = null;
  let filePath = null;
  let selectedBase = null;
  let modelList = [];

  const $ = (sel) => document.querySelector(sel);

  const weaponListEl = $('#weaponList');
  const searchInput = $('#searchInput');
  const filterTabs = $('#filterTabs');
  const weaponCount = $('#weaponCount');
  const fileInfo = $('#fileInfo');
  const noFileState = $('#noFileState');
  const emptyState = $('#emptyState');
  const weaponDetail = $('#weaponDetail');
  const detailName = $('#detailName');
  const detailId = $('#detailId');
  const detailClass = $('#detailClass');
  const detailIcon = $('#detailIcon');
  const detailBody = $('#detailBody');
  const toastContainer = $('#toastContainer');

  // ─── Known base weapon names for selection ──────────────────
  const BASE_WEAPONS = [
    'weapon_ak47', 'weapon_m4a1', 'weapon_m4a1_silencer', 'weapon_awp',
    'weapon_deagle', 'weapon_glock', 'weapon_usp_silencer', 'weapon_famas',
    'weapon_galilar', 'weapon_aug', 'weapon_sg556', 'weapon_ssg08',
    'weapon_scar20', 'weapon_g3sg1', 'weapon_mac10', 'weapon_mp9',
    'weapon_mp7', 'weapon_mp5sd', 'weapon_ump45', 'weapon_p90',
    'weapon_bizon', 'weapon_nova', 'weapon_xm1014', 'weapon_sawedoff',
    'weapon_mag7', 'weapon_m249', 'weapon_negev', 'weapon_p250',
    'weapon_fiveseven', 'weapon_cz75a', 'weapon_tec9', 'weapon_elite',
    'weapon_revolver', 'weapon_hkp2000', 'weapon_knife',
    'weapon_hegrenade', 'weapon_flashbang', 'weapon_smokegrenade',
    'weapon_molotov', 'weapon_incgrenade', 'weapon_decoy',
    'weapon_taser', 'weapon_healthshot', 'weapon_c4'
  ];

  const ORIGINAL_KEYS = new Set();

  const CATEGORIES = {
    combat: {
      label: 'Combat',
      dot: 'dot-combat',
      keys: ['m_nKillAward', 'm_nDamage', 'm_flHeadshotMultiplier', 'm_flArmorRatio', 'm_flPenetration',
        'm_flFlinchVelocityModifierLarge', 'm_flFlinchVelocityModifierSmall', 'm_flRange', 'm_flRangeModifier',
        'm_nNumBullets', 'm_nPrice', 'm_flCycleTime', 'm_nPrimaryAmmoType', 'm_nSecondaryAmmoType']
    },
    accuracy: {
      label: 'Accuracy',
      dot: 'dot-accuracy',
      keys: ['m_flSpread', 'm_flInaccuracyCrouch', 'm_flInaccuracyStand', 'm_flInaccuracyJump',
        'm_flInaccuracyJumpInitial', 'm_flInaccuracyJumpApex', 'm_flInaccuracyLand', 'm_flInaccuracyLadder',
        'm_flInaccuracyFire', 'm_flInaccuracyMove', 'm_flInaccuracyReload', 'm_nSpreadSeed',
        'm_flInaccuracyPitchShift', 'm_flInaccuracyAltSoundThreshold']
    },
    recoil: {
      label: 'Recoil & Recovery',
      dot: 'dot-recoil',
      keys: ['m_flRecoilAngle', 'm_flRecoilAngleVariance', 'm_flRecoilMagnitude', 'm_flRecoilMagnitudeVariance',
        'm_flRecoveryTimeCrouch', 'm_flRecoveryTimeStand', 'm_flRecoveryTimeCrouchFinal',
        'm_flRecoveryTimeStandFinal', 'm_nRecoveryTransitionStartBullet', 'm_nRecoveryTransitionEndBullet',
        'm_nRecoilSeed']
    },
    movement: {
      label: 'Movement',
      dot: 'dot-movement',
      keys: ['m_flMaxSpeed', 'm_flAttackMovespeedFactor']
    },
    zoom: {
      label: 'Zoom & Burst',
      dot: 'dot-zoom',
      keys: ['m_nZoomLevels', 'm_nZoomFOV1', 'm_nZoomFOV2', 'm_flZoomTime0', 'm_flZoomTime1',
        'm_flZoomTime2', 'm_bUnzoomsAfterShot', 'm_bHideViewModelWhenZoomed', 'm_bHasBurstMode']
    },
    general: {
      label: 'General',
      dot: 'dot-general',
      keys: ['m_iMaxClip1', 'm_iMaxClip2', 'm_iDefaultClip1', 'm_iDefaultClip2',
        'm_nPrimaryReserveAmmoMax', 'm_nSecondaryReserveAmmoMax', 'm_bIsFullAuto',
        'm_bMeleeWeapon', 'm_bCannotShootUnderwater', 'm_bIsRevolver', 'm_bAllowFlipping',
        'm_bBuiltRightHanded', 'm_iWeight', 'm_iRumbleEffect', 'm_bReserveAmmoAsClips',
        'm_bAutoSwitchFrom', 'm_bAutoSwitchTo', '_not_pickable',
        'm_eSilencerType', 'm_nCrosshairMinDistance', 'm_nCrosshairDeltaDistance',
        'm_nTracerFrequency', 'm_flDeployDuration', 'm_flDisallowAttackAfterReloadStartDuration',
        'm_WeaponType', 'm_GearSlot', 'm_GearSlotPosition']
    },
    model: {
      label: 'Models & Resources',
      dot: 'dot-model',
      keys: ['m_szName', 'm_szWorldModel', 'm_szTracerParticle', 'm_szAnimSkeleton',
        '_base', '_class', 'resource_name']
    },
    sound: {
      label: 'Sounds',
      dot: 'dot-sound',
      keys: ['m_aShootSounds']
    }
  };

  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = {
      success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
    el.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getIconName(weaponKey, data) {
    if (data && data.m_szName) {
      return data.m_szName.replace('weapon_', '');
    }
    if (weaponKey.startsWith('weapon_') && !weaponKey.endsWith('_prefab')) {
      return weaponKey.replace('weapon_', '');
    }
    if (weaponKey.endsWith('_prefab')) {
      return weaponKey.replace('weapon_', '').replace('_prefab', '');
    }
    return null;
  }

  function getWeaponType(key, data) {
    if (key.endsWith('_prefab')) return 'prefab';
    if (/^\d+$/.test(key)) return 'numbered';
    if (key.startsWith('weapon_')) return 'weapon';
    const baseTypes = ['statted_item_base', 'weapon_base', 'primary', 'secondary',
      'explosive_grenade', 'grenade', 'shotgun', 'rifle', 'equipment', 'smg',
      'sniper_rifle', 'machinegun', 'melee', 'melee_unusual', 'c4',
      'weapon_fire_grenade_prefab', 'default', 'generic_data_type'];
    if (baseTypes.includes(key)) return 'base';
    return 'other';
  }

  function createDefaultIcon(size) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.innerHTML = '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>';
    return svg;
  }

  const iconCache = {};

  function createIconElement(iconName, size = 24) {
    const container = document.createElement('div');
    container.style.width = size + 'px';
    container.style.height = size + 'px';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.flexShrink = '0';

    if (!iconName) {
      container.appendChild(createDefaultIcon(size));
      return container;
    }

    if (iconCache[iconName] !== undefined) {
      if (iconCache[iconName]) {
        container.innerHTML = iconCache[iconName];
        const svg = container.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', size);
          svg.setAttribute('height', size);
          svg.style.fill = 'currentColor';
        }
      } else {
        container.appendChild(createDefaultIcon(size));
      }
      return container;
    }

    container.appendChild(createDefaultIcon(size));

    window.electronAPI.getIcon(iconName).then(result => {
      if (result && result.success) {
        iconCache[iconName] = result.svg;
        container.innerHTML = result.svg;
        const svg = container.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', size);
          svg.setAttribute('height', size);
          svg.style.fill = 'currentColor';
        }
      } else {
        iconCache[iconName] = null;
      }
    }).catch(() => {
      iconCache[iconName] = null;
    });

    return container;
  }

  function syncData() {
    if (weaponData) {
      window.electronAPI.updateData(weaponData);
    }
  }

  $('#selectFileBtn').addEventListener('click', async () => {
    try {
      const json = await window.electronAPI.openFile();
      if (json.canceled) return;
      if (json.success) {
        weaponData = json.data;
        filePath = json.filePath;
        showMainApp();
        toast('File loaded successfully', 'success');
      } else {
        toast(json.error || 'Failed to load file', 'error');
      }
    } catch (err) {
      toast('Error loading file: ' + err.message, 'error');
    }
  });

  noFileState.addEventListener('click', async () => {
    $('#selectFileBtn').click();
  });
  noFileState.style.cursor = 'pointer';

  $('#loadDefaultBtn').addEventListener('click', async () => {
    try {
      const json = await window.electronAPI.loadDefault();
      if (json.success) {
        weaponData = json.data;
        filePath = json.filePath;
        showMainApp();
        toast('Default weapons.vdata loaded', 'success');
      } else {
        toast(json.error || 'Failed to load default file', 'error');
      }
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  });

  function showMainApp() {
    fileInfo.textContent = filePath || 'Untitled';
    currentKey = null;

    ORIGINAL_KEYS.clear();
    if (weaponData) {
      Object.keys(weaponData).forEach(k => {
        if (k !== '__orderedKeys') ORIGINAL_KEYS.add(k);
      });
    }

    renderWeaponList();
    showEmptyState();
  }

  function showNoFileState() {
    noFileState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    weaponDetail.classList.add('hidden');
    weaponListEl.innerHTML = '';
    weaponCount.textContent = '0 items';
    fileInfo.textContent = '';
  }

  function showEmptyState() {
    noFileState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    weaponDetail.classList.add('hidden');
  }

  showNoFileState();

  function getFilteredKeys() {
    if (!weaponData) return [];
    const keys = Object.keys(weaponData).filter(k => k !== '__orderedKeys' && k !== 'generic_data_type');
    const search = searchInput.value.toLowerCase();
    const activeFilter = filterTabs.querySelector('.filter-tab.active')?.dataset.filter || 'all';

    return keys.filter(key => {
      const data = weaponData[key];
      const type = getWeaponType(key, data);

      if (search && !key.toLowerCase().includes(search)) {
        const name = data?.m_szName || '';
        if (!name.toLowerCase().includes(search)) return false;
      }

      if (activeFilter === 'weapons') return type === 'weapon';
      if (activeFilter === 'prefabs') return type === 'prefab';
      if (activeFilter === 'numbered') return type === 'numbered';
      if (activeFilter === 'custom') return type === 'weapon' && !BASE_WEAPONS.includes(key);
      return true;
    });
  }

  function renderWeaponList() {
    const keys = getFilteredKeys();
    weaponListEl.innerHTML = '';

    keys.forEach(key => {
      const data = weaponData[key];
      if (typeof data !== 'object' || data === null) return;

      const type = getWeaponType(key, data);
      const iconName = getIconName(key, data);
      const szName = data.m_szName || '';

      const item = document.createElement('div');
      item.className = `weapon-item${currentKey === key ? ' active' : ''}`;
      item.dataset.key = key;

      const badgeClass = {
        weapon: 'badge-weapon', prefab: 'badge-prefab',
        numbered: 'badge-id', base: 'badge-base', other: 'badge-base'
      }[type] || 'badge-base';

      const badgeText = {
        weapon: 'WPN', prefab: 'PRE', numbered: 'ID',
        base: 'BASE', other: 'SYS'
      }[type] || '';

      item.innerHTML = `
        <div class="weapon-item-icon"></div>
        <div class="weapon-item-info">
          <div class="weapon-item-name">${escapeHtml(key)}</div>
          <div class="weapon-item-type">${szName ? escapeHtml(szName) : ''}</div>
        </div>
        <span class="weapon-item-badge ${badgeClass}">${badgeText}</span>
      `;

      const iconContainer = item.querySelector('.weapon-item-icon');
      iconContainer.appendChild(createIconElement(iconName, 24));

      item.addEventListener('click', () => selectWeapon(key));
      weaponListEl.appendChild(item);
    });

    weaponCount.textContent = `${keys.length} items`;
  }

  searchInput.addEventListener('input', renderWeaponList);
  filterTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-tab')) {
      filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderWeaponList();
    }
  });

  function selectWeapon(key) {
    currentKey = key;
    const data = weaponData[key];

    weaponListEl.querySelectorAll('.weapon-item').forEach(item => {
      item.classList.toggle('active', item.dataset.key === key);
    });

    noFileState.classList.add('hidden');
    emptyState.classList.add('hidden');
    weaponDetail.classList.remove('hidden');

    const iconName = getIconName(key, data);
    detailIcon.innerHTML = '';
    detailIcon.appendChild(createIconElement(iconName, 40));

    detailName.textContent = key;

    if (/^\d+$/.test(key)) {
      detailId.textContent = `ID: ${key}`;
      detailId.style.display = 'block';
    } else {
      detailId.textContent = '';
      detailId.style.display = 'none';
    }

    if (data.m_szName) {
      detailClass.textContent = `m_szName: ${data.m_szName}`;
    } else if (data._class) {
      detailClass.textContent = `_class: ${data._class}`;
    } else {
      detailClass.textContent = key;
    }

    const isCustom = !ORIGINAL_KEYS.has(key);
    const deleteBtn = $('#deleteBtn');
    if (isCustom) {
      deleteBtn.style.display = '';
      deleteBtn.disabled = false;
      deleteBtn.title = 'Delete this custom weapon';
    } else {
      deleteBtn.style.display = 'none';
    }

    renderDetailBody(key, data);
  }

  function renderDetailBody(key, data) {
    detailBody.innerHTML = '';

    const categorized = {};
    const uncategorized = [];

    const allCatKeys = new Set();
    for (const cat of Object.values(CATEGORIES)) {
      cat.keys.forEach(k => allCatKeys.add(k));
    }

    const dataKeys = data.__orderedKeys || Object.keys(data);

    for (const propKey of dataKeys) {
      if (propKey === '__orderedKeys') continue;
      let found = false;
      for (const [catId, cat] of Object.entries(CATEGORIES)) {
        if (cat.keys.includes(propKey)) {
          if (!categorized[catId]) categorized[catId] = [];
          categorized[catId].push(propKey);
          found = true;
          break;
        }
      }
      if (!found) {
        uncategorized.push(propKey);
      }
    }

    for (const [catId, cat] of Object.entries(CATEGORIES)) {
      const props = categorized[catId];
      if (!props || props.length === 0) continue;
      renderSection(cat.label, cat.dot, props, data, key);
    }

    if (uncategorized.length > 0) {
      renderSection('Other', 'dot-other', uncategorized, data, key);
    }
  }

  function renderSection(label, dotClass, propKeys, data, weaponKey) {
    const section = document.createElement('div');
    section.className = 'prop-section';

    const header = document.createElement('div');
    header.className = 'prop-section-header';
    header.innerHTML = `
      <div class="prop-section-title">
        <span class="section-dot ${dotClass}"></span>
        ${escapeHtml(label)}
        <span style="color:var(--text-muted);font-weight:400;font-size:11px">(${propKeys.length})</span>
      </div>
      <svg class="prop-section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    `;
    header.addEventListener('click', () => section.classList.toggle('collapsed'));

    const body = document.createElement('div');
    body.className = 'prop-section-body';

    for (const propKey of propKeys) {
      const val = data[propKey];
      renderProperty(body, propKey, val, weaponKey, [propKey]);
    }

    section.appendChild(header);
    section.appendChild(body);
    detailBody.appendChild(section);
  }

  function renderProperty(container, propKey, val, weaponKey, path) {
    if (Array.isArray(val)) {
      const wrap = document.createElement('div');
      wrap.className = 'prop-row';
      wrap.style.gridTemplateColumns = '1fr';

      const keyEl = document.createElement('div');
      keyEl.className = 'prop-key';
      keyEl.textContent = propKey;
      wrap.appendChild(keyEl);

      const arrContainer = document.createElement('div');
      arrContainer.className = 'prop-array-container';

      val.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          const nested = document.createElement('div');
          nested.className = 'prop-nested';
          const nestedKeys = item.__orderedKeys || Object.keys(item);
          for (const nk of nestedKeys) {
            if (nk === '__orderedKeys') continue;
            renderProperty(nested, nk, item[nk], weaponKey, [...path, i, nk]);
          }
          arrContainer.appendChild(nested);
        } else {
          const arrItem = document.createElement('div');
          arrItem.className = 'prop-array-item';
          arrItem.innerHTML = `<span class="prop-array-index">[${i}]</span>`;
          const input = document.createElement('input');
          input.type = 'text';
          input.value = item;
          input.dataset.path = JSON.stringify([...path, i]);
          input.addEventListener('change', (e) => {
            updateArrayValue(weaponKey, path, i, e.target.value);
            e.target.classList.add('modified');
            syncData();
          });
          arrItem.appendChild(input);
          arrContainer.appendChild(arrItem);
        }
      });

      wrap.appendChild(arrContainer);
      container.appendChild(wrap);
    } else if (typeof val === 'object' && val !== null) {
      const wrap = document.createElement('div');
      wrap.className = 'prop-row';
      wrap.style.gridTemplateColumns = '1fr';

      const keyEl = document.createElement('div');
      keyEl.className = 'prop-key';
      keyEl.textContent = propKey;
      wrap.appendChild(keyEl);

      const nested = document.createElement('div');
      nested.className = 'prop-nested';
      const nestedKeys = val.__orderedKeys || Object.keys(val);
      for (const nk of nestedKeys) {
        if (nk === '__orderedKeys') continue;
        renderProperty(nested, nk, val[nk], weaponKey, [...path, nk]);
      }
      wrap.appendChild(nested);
      container.appendChild(wrap);
    } else if (typeof val === 'boolean') {
      const row = document.createElement('div');
      row.className = 'prop-row';
      row.innerHTML = `<div class="prop-key">${escapeHtml(propKey)}</div>`;

      const valDiv = document.createElement('div');
      valDiv.className = 'prop-value prop-value-bool';

      const toggle = document.createElement('button');
      toggle.className = `toggle${val ? ' active' : ''}`;

      const label = document.createElement('span');
      label.style.fontSize = '12px';
      label.style.color = 'var(--text-secondary)';
      label.textContent = val ? 'true' : 'false';

      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        const newVal = toggle.classList.contains('active');
        label.textContent = newVal ? 'true' : 'false';
        updatePropertyValue(weaponKey, path, newVal);
        syncData();
      });

      valDiv.appendChild(toggle);
      valDiv.appendChild(label);
      row.appendChild(valDiv);
      container.appendChild(row);
    } else {
      const row = document.createElement('div');
      row.className = 'prop-row';
      row.innerHTML = `<div class="prop-key">${escapeHtml(propKey)}</div>`;

      const valDiv = document.createElement('div');
      valDiv.className = 'prop-value';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = val !== undefined && val !== null ? val : '';
      input.addEventListener('change', (e) => {
        updatePropertyValue(weaponKey, path, parseInputValue(e.target.value));
        e.target.classList.add('modified');
        syncData();
      });
      valDiv.appendChild(input);
      row.appendChild(valDiv);
      container.appendChild(row);
    }
  }

  function parseInputValue(str) {
    if (str === 'true') return true;
    if (str === 'false') return false;
    if (str.startsWith('resource_name:') || str.startsWith('soundevent:')) return str;
    if (/^-?\d+$/.test(str)) return parseInt(str, 10);
    if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
    return str;
  }

  function updatePropertyValue(weaponKey, path, value) {
    let obj = weaponData[weaponKey];
    for (let i = 0; i < path.length - 1; i++) {
      obj = obj[path[i]];
    }
    obj[path[path.length - 1]] = value;
  }

  function updateArrayValue(weaponKey, arrayPath, index, value) {
    let obj = weaponData[weaponKey];
    for (let i = 0; i < arrayPath.length; i++) {
      obj = obj[arrayPath[i]];
    }
    obj[index] = parseInputValue(value);
  }

  $('#downloadBtn').addEventListener('click', async () => {
    if (!weaponData) return toast('No data to save', 'warning');
    try {
      syncData();
      const json = await window.electronAPI.saveAs();
      if (json.canceled) return;
      if (json.success) {
        toast('File saved: ' + json.filePath, 'success');
      } else {
        toast(json.error || 'Save failed', 'error');
      }
    } catch (err) {
      toast('Save error: ' + err.message, 'error');
    }
  });

  $('#deleteBtn').addEventListener('click', async () => {
    if (!currentKey) return;
    if (ORIGINAL_KEYS.has(currentKey)) {
      toast('Cannot delete in-game weapons. Only custom weapons can be deleted.', 'warning');
      return;
    }
    if (!confirm(`Delete "${currentKey}"?`)) return;
    try {
      const json = await window.electronAPI.deleteWeapon(currentKey);
      if (json.success) {
        delete weaponData[currentKey];
        if (weaponData.__orderedKeys) {
          weaponData.__orderedKeys = weaponData.__orderedKeys.filter(k => k !== currentKey);
        }
        currentKey = null;
        renderWeaponList();
        showEmptyState();
        toast('Weapon deleted', 'success');
      } else {
        toast(json.error, 'error');
      }
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  });

  $('#duplicateBtn').addEventListener('click', () => {
    if (!currentKey || !weaponData[currentKey]) return;
    const newKey = currentKey + '_copy';
    if (weaponData[newKey]) return toast('Copy already exists', 'warning');

    const clone = JSON.parse(JSON.stringify(weaponData[currentKey]));
    weaponData[newKey] = clone;
    if (weaponData.__orderedKeys) {
      weaponData.__orderedKeys.push(newKey);
    }
    syncData();
    renderWeaponList();
    selectWeapon(newKey);
    toast(`Duplicated as "${newKey}"`, 'success');
  });

  const addModal = $('#addWeaponModal');
  const baseGrid = $('#baseWeaponGrid');

  $('#addWeaponBtn').addEventListener('click', () => {
    if (!weaponData) return toast('Load a file first', 'warning');
    addModal.classList.remove('hidden');
    selectedBase = null;
    $('#newWeaponName').value = '';
    $('#newResourceName').value = '';
    populateBaseGrid(baseGrid, (key) => { selectedBase = key; });
  });

  $('#closeAddModal').addEventListener('click', () => addModal.classList.add('hidden'));
  $('#cancelAdd').addEventListener('click', () => addModal.classList.add('hidden'));

  addModal.addEventListener('click', (e) => {
    if (e.target === addModal) addModal.classList.add('hidden');
  });

  function populateBaseGrid(container, onSelect) {
    container.innerHTML = '';
    const allBases = [...BASE_WEAPONS];

    if (weaponData) {
      for (const [key, val] of Object.entries(weaponData)) {
        if (key === '__orderedKeys' || typeof val !== 'object') continue;
        const szName = val?.m_szName || '';
        if (szName.startsWith('weapon_knife') && !allBases.includes(key)) {
          allBases.push(key);
        }
      }
    }

    const weapons = allBases.filter(w => weaponData && weaponData[w]);
    const regularWeapons = weapons.filter(w => {
      const d = weaponData[w];
      const name = d?.m_szName || w;
      return !name.includes('knife');
    });
    const knives = weapons.filter(w => {
      const d = weaponData[w];
      const name = d?.m_szName || w;
      return name.includes('knife');
    });

    function addSectionLabel(text) {
      const label = document.createElement('div');
      label.style.cssText = 'grid-column:1/-1;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;padding:8px 4px 4px;border-bottom:1px solid var(--border-glass);margin-bottom:4px;';
      label.textContent = text;
      container.appendChild(label);
    }

    function addOption(wKey) {
      const data = weaponData[wKey];
      const szName = data?.m_szName || wKey;
      const iconName = getIconName(wKey, data);
      const displayLabel = szName.replace('weapon_', '');

      const option = document.createElement('div');
      option.className = 'base-weapon-option';
      option.dataset.key = wKey;

      const iconEl = createIconElement(iconName, 32);
      option.appendChild(iconEl);

      const span = document.createElement('span');
      span.textContent = displayLabel;
      option.appendChild(span);

      option.addEventListener('click', () => {
        container.querySelectorAll('.base-weapon-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        onSelect(wKey);
      });

      container.appendChild(option);
    }

    if (regularWeapons.length > 0) {
      addSectionLabel('Weapons');
      regularWeapons.forEach(addOption);
    }
    if (knives.length > 0) {
      addSectionLabel('Knives');
      knives.forEach(addOption);
    }
  }

  $('#confirmAdd').addEventListener('click', async () => {
    const name = $('#newWeaponName').value.trim();
    const resourceName = $('#newResourceName').value.trim();

    if (!name) return toast('Enter a weapon name', 'warning');
    if (!selectedBase) return toast('Select a base weapon', 'warning');

    try {
      const json = await window.electronAPI.addWeapon(name, selectedBase, resourceName || undefined);
      if (json.success) {
        weaponData[name] = json.data;
        if (weaponData.__orderedKeys) {
          weaponData.__orderedKeys.push(name);
        }
        addModal.classList.add('hidden');
        renderWeaponList();
        selectWeapon(name);
        toast(`Weapon "${name}" added`, 'success');
      } else {
        toast(json.error, 'error');
      }
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  });

  const quickModal = $('#quickAddModal');
  const quickStep1 = $('#quickStep1');
  const quickStep2 = $('#quickStep2');
  const continueBtn = $('#continueQuick');
  const confirmQuickBtn = $('#confirmQuick');
  const modelConfigList = $('#modelConfigList');

  $('#quickAddBtn').addEventListener('click', () => {
    if (!weaponData) return toast('Load a file first', 'warning');
    quickModal.classList.remove('hidden');
    quickStep1.classList.remove('hidden');
    quickStep2.classList.add('hidden');
    continueBtn.classList.add('hidden');
    confirmQuickBtn.classList.add('hidden');
    modelList = [];
    $('#modelFileInput').value = '';
  });

  $('#closeQuickModal').addEventListener('click', () => quickModal.classList.add('hidden'));
  $('#cancelQuick').addEventListener('click', () => quickModal.classList.add('hidden'));
  quickModal.addEventListener('click', (e) => {
    if (e.target === quickModal) quickModal.classList.add('hidden');
  });

  $('#modelFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target.result;
        const json = await window.electronAPI.parseModels(content);
        modelList = json.models || [];

        if (modelList.length === 0) {
          toast('No .vmdl models found in file', 'warning');
          return;
        }

        toast(`Found ${modelList.length} models`, 'info');
        continueBtn.classList.remove('hidden');
      } catch (err) {
        toast('Error parsing models: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  });

  continueBtn.addEventListener('click', () => {
    quickStep1.classList.add('hidden');
    quickStep2.classList.remove('hidden');
    continueBtn.classList.add('hidden');
    confirmQuickBtn.classList.remove('hidden');
    renderModelConfig();
  });

  function renderModelConfig() {
    modelConfigList.innerHTML = '';

    const baseOptions = BASE_WEAPONS.filter(w => weaponData && weaponData[w])
      .map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w.replace('weapon_', ''))}</option>`)
      .join('');

    modelList.forEach((modelPath, i) => {
      const parts = modelPath.split('/');
      const fileName = parts[parts.length - 1].replace('.vmdl', '').replace(/_ag2$/i, '');

      const item = document.createElement('div');
      item.className = 'model-item';
      item.innerHTML = `
        <div class="model-item-path">${escapeHtml(modelPath)}</div>
        <div class="model-item-row">
          <input type="text" class="input-glass model-name-input" value="${escapeHtml(fileName)}" placeholder="Weapon name..." data-index="${i}">
          <select class="model-base-select" data-index="${i}">
            ${baseOptions}
          </select>
        </div>
      `;
      modelConfigList.appendChild(item);
    });
  }

  confirmQuickBtn.addEventListener('click', async () => {
    const weapons = [];
    const nameInputs = modelConfigList.querySelectorAll('.model-name-input');
    const baseSelects = modelConfigList.querySelectorAll('.model-base-select');

    nameInputs.forEach((input, i) => {
      const name = input.value.trim();
      const baseKey = baseSelects[i].value;
      if (name && baseKey) {
        weapons.push({
          key: name,
          baseKey: baseKey,
          modelPath: modelList[i],
          name: name
        });
      }
    });

    if (weapons.length === 0) return toast('No weapons to add', 'warning');

    try {
      const json = await window.electronAPI.batchAdd(weapons);
      let success = 0, fail = 0;
      for (const r of json.results) {
        if (r.success) {
          success++;
          if (!weaponData[r.key]) {
            const base = weaponData[weapons.find(w => w.key === r.key)?.baseKey];
            if (base) {
              weaponData[r.key] = JSON.parse(JSON.stringify(base));
              weaponData[r.key].m_szWorldModel = `resource_name:"${weapons.find(w => w.key === r.key)?.modelPath}"`;
              if (weaponData.__orderedKeys) weaponData.__orderedKeys.push(r.key);
            }
          }
        } else {
          fail++;
        }
      }

      quickModal.classList.add('hidden');
      renderWeaponList();
      toast(`Added ${success} weapons${fail > 0 ? `, ${fail} failed` : ''}`, success > 0 ? 'success' : 'error');
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      $('#downloadBtn').click();
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
  });

})();
