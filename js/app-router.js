(function(){
  var supabase = window.dccSupabase;

  var TABS = window.DCC_TABS;

  var TAB_BY_ID = {};
  TABS.forEach(function(t){ TAB_BY_ID[t.id] = t; });

  var TABLES = [
    'home',
    'attendance',
    'fms_systems',
    'ims',
    'mis',
    'crm',
    'delegation',
    'human_resource'
  ];

  var store = {};
  TABLES.forEach(function(t){
    store[t] = { status:'loading', rows:null, error:null };
  });

  var MENUS = window.DCC_MENUS;

  var homeView = document.getElementById('home-view');
  var appView = document.getElementById('app-view');
  var appTitle = document.getElementById('app-title');
  var appBack = document.getElementById('app-back');
  var tabsEl = document.getElementById('sys-tabs');
  var panelsEl = document.getElementById('sys-panels');
  var navLinks = document.getElementById('nav-links');
  var megaMenu = document.getElementById('mega-menu');
  var megaInner = document.getElementById('mega-inner');
  var brandHome = document.getElementById('brand-home');
  var viewOrdersBtn = document.getElementById('view-orders-btn');
  var navToggle = document.getElementById('nav-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  var mobileNavSections = document.getElementById('mobile-nav-sections');
  var searchFab = document.getElementById('search-fab');
  var searchPanel = document.getElementById('search-panel');
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var searchEmpty = document.getElementById('search-empty');

  var fetched = {};
  var activeTabId = null;
  var openMenuKey = null;
  var searchDebounce = null;
  var searchLoadPromise = null;

  var SEARCHABLE_TABLES = TABLES.filter(function(table){
    return table !== 'home';
  });

  function loadHeroTagline(){
    return supabase
      .from('hero_taglines')
      .select('headline, subtext')
      .then(function(res){
        if(res.error || !res.data || !res.data.length){
          return;
        }

        var rows = res.data;
        var pick = rows[Math.floor(Math.random() * rows.length)];
        var heading = document.querySelector('#hero-content h1');
        var paragraph = document.querySelector('#hero-content p.lede');

        if(pick && heading && paragraph){
          heading.textContent = pick.headline;
          paragraph.textContent = pick.subtext;
        }
      })
      .catch(function(){});
  }

  var heroTaglineReady = loadHeroTagline();

  function esc(str){
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(c){
      return {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[c];
    });
  }

  TABS.forEach(function(tab){
    var btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.type = 'button';
    btn.textContent = tab.label;
    btn.addEventListener('click', function(){
      navigateTo(tab.id);
    });
    tabsEl.appendChild(btn);

    var panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'sys-panel-' + tab.id;
    panelsEl.appendChild(panel);
  });

  function setActiveTabUI(id){
    Array.prototype.forEach.call(tabsEl.children, function(btn, i){
      btn.classList.toggle('active', TABS[i].id === id);
    });

    Array.prototype.forEach.call(panelsEl.children, function(panel){
      panel.classList.toggle('active', panel.id === 'sys-panel-' + id);
    });
  }

  function renderSkeleton(panel, count){
    var grid = document.createElement('div');
    grid.className = 'skeleton-grid';

    for(var i = 0; i < (count || 4); i++){
      var skeleton = document.createElement('div');
      skeleton.className = 'skeleton-line';
      grid.appendChild(skeleton);
    }

    panel.appendChild(grid);
  }

  function renderError(panel, message){
    panel.insertAdjacentHTML(
      'beforeend',
      '<div class="panel-error">Couldn\'t load this section: ' +
      esc(message) +
      '. <a href="#" class="retry-link" style="color:#f0a3a2;text-decoration:underline;">Try again</a></div>'
    );

    var retry = panel.querySelector('.retry-link');

    if(retry){
      retry.addEventListener('click', function(e){
        e.preventDefault();

        var tableForPanel = panel.getAttribute('data-table');
        if(tableForPanel) fetchTable(tableForPanel);
      });
    }
  }

  function renderEmpty(panel, text){
    panel.insertAdjacentHTML(
      'beforeend',
      '<div class="panel-empty">' + esc(text) + '</div>'
    );
  }

  function renderLinkCards(panel, rows){
    if(!rows || rows.length === 0){
      renderEmpty(panel, 'Nothing here yet.');
      return;
    }

    var grid = document.createElement('div');
    grid.className = 'card-grid';

    rows.forEach(function(row){
      var card = document.createElement('div');
      card.className = 'link-card';

      var label = document.createElement('span');
      label.className = 'label';
      label.textContent = row.label || 'Untitled';

      var link = document.createElement('a');
      link.className = 'open-link';
      link.textContent = 'Open';
      link.href = row.sheet_url || '#';
      link.target = '_blank';
      link.rel = 'noopener';

      card.appendChild(label);
      card.appendChild(link);
      grid.appendChild(card);
    });

    panel.appendChild(grid);
  }

  function startSearchDataLoad(){
    if(searchLoadPromise){ return searchLoadPromise; }

    var pending = SEARCHABLE_TABLES.filter(function(table){
      return !fetched[table];
    }).map(function(table){
      fetched[table] = true;
      return fetchTable(table);
    });

    searchLoadPromise = Promise.all(pending);
    return searchLoadPromise;
  }

  function findSearchTab(table, row){
    for(var i = 0; i < TABS.length; i++){
      var tab = TABS[i];
      if(tab.table === table && (!tab.filter || tab.filter(row))){
        return tab;
      }
    }

    return null;
  }

  function renderSearchResults(query){
    searchResults.innerHTML = '';
    searchEmpty.style.display = 'none';

    if(!query){ return; }

    var needle = query.toLowerCase();
    var results = [];

    Object.keys(MENUS).forEach(function(key){
      MENUS[key].items.forEach(function(item){
        if(item.label.toLowerCase().indexOf(needle) !== -1){
          results.push({ label:item.label, tab:item.tab });
        }
      });
    });

    SEARCHABLE_TABLES.forEach(function(table){
      var entry = store[table];
      if(!entry || entry.status !== 'ready'){ return; }

      (entry.rows || []).forEach(function(row){
        if(!row.label || row.label.toLowerCase().indexOf(needle) === -1){ return; }

        var tab = findSearchTab(table, row);
        if(tab){
          results.push({ label:row.label, sublabel:tab.label, tab:tab.id });
        }
      });
    });

    results.slice(0, 8).forEach(function(result){
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result';

      var label = document.createElement('span');
      label.className = 'result-label';
      label.textContent = result.label;
      button.appendChild(label);

      if(result.sublabel){
        var sublabel = document.createElement('span');
        sublabel.className = 'result-sublabel';
        sublabel.textContent = result.sublabel;
        button.appendChild(sublabel);
      }

      button.addEventListener('click', function(){
        navigateTo(result.tab);
        closeSearch();
      });
      searchResults.appendChild(button);
    });

    if(!results.length){
      searchEmpty.style.display = 'block';
    }
  }

  function refreshSearchResults(){
    var query = searchInput.value.trim();
    if(!query){
      renderSearchResults('');
      return;
    }

    if(SEARCHABLE_TABLES.some(function(table){ return store[table].status === 'loading'; })){
      searchResults.textContent = 'Loading…';
      searchEmpty.style.display = 'none';
      return;
    }

    renderSearchResults(query);
  }

  function closeSearch(){
    searchPanel.classList.remove('open');
    searchFab.setAttribute('aria-expanded', 'false');
    searchInput.value = '';
    renderSearchResults('');
  }

  function openSearch(){
    closeMenu();
    closeMobileNav();
    var musicPanel = document.getElementById('music-panel');
    var musicFab = document.getElementById('music-fab');
    if(musicPanel){ musicPanel.classList.remove('open'); }
    if(musicFab){ musicFab.setAttribute('aria-expanded', 'false'); }
    searchPanel.classList.add('open');
    searchFab.setAttribute('aria-expanded', 'true');
    searchInput.focus();
    startSearchDataLoad().then(refreshSearchResults);
    refreshSearchResults();
  }

  function renderNestedLocationFilters(panel, rows){
    var filterRow = document.createElement('div');
    filterRow.className = 'nested-filters';

    [
      { label:'All', value:null },
      { label:'Gurgaon', value:'Gurgaon' },
      { label:'Okhla', value:'Okhla' }
    ].forEach(function(option, index){
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab-btn' + (index === 0 ? ' active' : '');
      button.textContent = option.label;
      button.addEventListener('click', function(){
        Array.prototype.forEach.call(filterRow.children, function(child){
          child.classList.remove('active');
        });
        button.classList.add('active');
        var existingGrid = panel.querySelector('.card-grid');
        var existingEmpty = panel.querySelector('.panel-empty');
        if(existingGrid){ existingGrid.remove(); }
        if(existingEmpty){ existingEmpty.remove(); }
        renderLinkCards(panel, option.value === null
          ? rows
          : rows.filter(function(row){ return row.location === option.value; }));
        var count = panel.querySelector('.count');
        if(count){
          var visibleRows = option.value === null
            ? rows
            : rows.filter(function(row){ return row.location === option.value; });
          count.textContent = visibleRows.length + (visibleRows.length === 1 ? ' link' : ' links');
        }
      });
      filterRow.appendChild(button);
    });

    panel.appendChild(filterRow);
  }

  var defaultHomeQuotes = [
    { quote_title:'Operations insight', quote_text:'Good operations make complexity feel simple.', quote_author:'DCC leadership', quote_author_url:'', more_quotes_url:'', map_label:'Okhla command map', map_url:'' },
    { quote_title:'Execution focus', quote_text:'Every smooth delivery starts with disciplined execution.', quote_author:'Warehouse team', quote_author_url:'', more_quotes_url:'', map_label:'Gurgaon network map', map_url:'' },
    { quote_title:'Decision visibility', quote_text:'Visibility turns daily operations into decisions.', quote_author:'Supply chain desk', quote_author_url:'', more_quotes_url:'', map_label:'Head office overview', map_url:'' },
    { quote_title:'Movement discipline', quote_text:'Strong supply chains are built one accurate movement at a time.', quote_author:'Ops review board', quote_author_url:'', more_quotes_url:'', map_label:'Distribution route view', map_url:'' },
    { quote_title:'Flow control', quote_text:'Fast decisions only work when the floor knows the truth.', quote_author:'Logistics control room', quote_author_url:'', more_quotes_url:'', map_label:'Live warehouse view', map_url:'' },
    { quote_title:'Reliable rhythm', quote_text:'Execution is most visible when the process stays calm under pressure.', quote_author:'Operations desk', quote_author_url:'', more_quotes_url:'', map_label:'Route coordination', map_url:'' },
    { quote_title:'Delivery quality', quote_text:'A strong warehouse is measured by clarity, not chaos.', quote_author:'Dispatch leadership', quote_author_url:'', more_quotes_url:'', map_label:'Dock schedule board', map_url:'' },
    { quote_title:'Team rhythm', quote_text:'When each movement is clear, the whole operation sharpens.', quote_author:'Team performance review', quote_author_url:'', more_quotes_url:'', map_label:'Cross-site overview', map_url:'' },
    { quote_title:'Operational clarity', quote_text:'The best systems reduce friction before the problem reaches a person.', quote_author:'Process design team', quote_author_url:'', more_quotes_url:'', map_label:'Process map', map_url:'' },
    { quote_title:'Execution rhythm', quote_text:'Delivery confidence comes from visible decisions and honest flow data.', quote_author:'DCC operations', quote_author_url:'', more_quotes_url:'', map_label:'Dispatch map', map_url:'' }
  ];

  var homeQuotes = [];
  var homeQuoteIndex = 0;
  var quoteTimer = null;

  function stopQuoteRotation(){
    if(quoteTimer){
      clearInterval(quoteTimer);
      quoteTimer = null;
    }
  }

  function showNextQuote(){
    if(!homeQuotes.length){ return; }

    homeQuoteIndex = (homeQuoteIndex + 1) % homeQuotes.length;
    homeQuoteRotator.renderCurrent();
  }

  function showPreviousQuote(){
    if(!homeQuotes.length){ return; }

    homeQuoteIndex = (homeQuoteIndex - 1 + homeQuotes.length) % homeQuotes.length;
    homeQuoteRotator.renderCurrent();
  }

  function startQuoteRotation(){
    stopQuoteRotation();

    if(!homeQuotes.length || homeQuotes.length <= 1){
      return;
    }

    quoteTimer = setInterval(function(){
      showNextQuote();
    }, 7500);
  }

  function normalizeHomeQuotes(rows){
    var normalized = [];
    var seen = {};

    if(rows && rows.length){
      rows.forEach(function(row){
        if(!row){ return; }

        var text = (row.quote_text || '').toString().trim();
        if(!text){ return; }

        var key = (row.quote_text || '') + '::' + (row.quote_author || '');
        if(seen[key]){ return; }
        seen[key] = true;

        var title = (row.quote_title || '').toString().trim();
        var author = (row.quote_author || '').toString().trim();

        normalized.push({
          quote_title: title || '',
          quote_text: text,
          quote_author: author || '',
          quote_author_url: (row.quote_author_url || '').toString().trim(),
          more_quotes_url: (row.more_quotes_url || '').toString().trim(),
          map_label: (row.map_label || 'Office map').toString().trim() || 'Office map',
          map_url: (row.map_url || '').toString().trim()
        });
      });
    }

    if(!normalized.length){
      return defaultHomeQuotes.map(function(item){ return Object.assign({}, item); });
    }

    homeQuotes = normalized;

    if(homeQuoteIndex >= homeQuotes.length){
      homeQuoteIndex = 0;
    }

    return homeQuotes;
  }

  var homeQuoteRotator = {
    panel: null,
    rows: [],
    index: 0,
    timer: null,

    stop: function(){
      if(this.timer){
        clearInterval(this.timer);
        this.timer = null;
      }
    },

    start: function(panel, rows){
      this.stop();
      this.panel = panel;
      this.rows = normalizeHomeQuotes(rows);

      if(!this.rows.length || !this.panel){
        stopQuoteRotation();
        return;
      }

      if(homeQuoteIndex >= this.rows.length){
        homeQuoteIndex = 0;
      }

      this.renderCurrent();
      startQuoteRotation();
    },

    renderCurrent: function(){
      if(!this.panel || !this.rows.length){
        return;
      }

      var row = this.rows[homeQuoteIndex];
      var existingWrap = this.panel.querySelector('.home-grid');
      var existingControls = this.panel.querySelector('.quote-controls');
      if(existingWrap){ existingWrap.remove(); }
      if(existingControls){ existingControls.remove(); }

      var nextWrap = document.createElement('div');
      nextWrap.className = 'home-grid';

      var quoteCard = document.createElement('div');
      quoteCard.className = 'quote-card floating-mid';

      var title = row.quote_title ? '<p class="qtitle">' + esc(row.quote_title) + '</p>' : '';
      var author = row.quote_author
        ? (
            row.quote_author_url
              ? '<a class="qauthor" href="' + esc(row.quote_author_url) + '" target="_blank" rel="noopener">— ' + esc(row.quote_author) + '</a>'
              : '<span class="qauthor">— ' + esc(row.quote_author) + '</span>'
          )
        : '';
      var more = row.more_quotes_url
        ? '<a class="qmore" href="' + esc(row.more_quotes_url) + '" target="_blank" rel="noopener">More quotes →</a>'
        : '';

      var quoteText = document.createElement('blockquote');
      quoteText.className = 'quote-text';
      quoteText.textContent = row.quote_text || '';

      quoteCard.innerHTML = title + '<div class="quote-body"></div>' + author + more;
      quoteCard.querySelector('.quote-body').appendChild(quoteText);

      var mapCard = document.createElement('div');
      mapCard.className = 'map-card floating-slow';
      mapCard.innerHTML =
        '<div class="mlabel">' + esc(row.map_label || 'Office map') + '</div>' +
        (row.map_url ? '<a class="maplink" href="' + esc(row.map_url) + '" target="_blank" rel="noopener">Open map</a>' : '');

      var controls = document.createElement('div');
      controls.className = 'quote-controls';

      var prevButton = document.createElement('button');
      prevButton.type = 'button';
      prevButton.textContent = '‹';
      prevButton.setAttribute('aria-label', 'Previous quote');
      prevButton.addEventListener('click', function(){
        showPreviousQuote();
      });

      var nextButton = document.createElement('button');
      nextButton.type = 'button';
      nextButton.textContent = '›';
      nextButton.setAttribute('aria-label', 'Next quote');
      nextButton.addEventListener('click', function(){
        showNextQuote();
      });

      var dots = document.createElement('div');
      dots.className = 'quote-dots';
      for(var i = 0; i < this.rows.length; i++){
        var dot = document.createElement('span');
        dot.className = 'quote-dot' + (i === homeQuoteIndex ? ' active' : '');
        dot.setAttribute('data-index', i);
        dot.addEventListener('click', function(){
          homeQuoteIndex = Number(this.getAttribute('data-index'));
          homeQuoteRotator.renderCurrent();
        });
        dots.appendChild(dot);
      }

      var nav = document.createElement('div');
      nav.className = 'quote-nav';
      nav.appendChild(prevButton);
      nav.appendChild(nextButton);
      controls.appendChild(nav);
      controls.appendChild(dots);

      nextWrap.appendChild(quoteCard);
      nextWrap.appendChild(mapCard);
      this.panel.appendChild(nextWrap);
      this.panel.appendChild(controls);

      var quoteAuthor = quoteCard.querySelector('.qauthor');
      if(quoteAuthor){
        quoteAuthor.style.display = 'block';
      }

      var timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
      timeline.fromTo(nextWrap, { opacity: 0, y: 14, filter: 'blur(8px)', scale: 0.99 }, { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, duration: 0.6 })
        .fromTo(quoteCard, { opacity: 0, y: 18, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.52 }, 0.08)
        .fromTo(mapCard, { opacity: 0, y: 12, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.52 }, 0.12)
        .fromTo(controls, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.38 }, 0.18);

      if(quoteText){
        gsap.to(quoteText, { y: 0, duration: 4.5, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatDelay: 0.2 });
      }

      if(quoteAuthor){
        gsap.to(quoteAuthor, { y: 0, duration: 5.2, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatDelay: 0.15 });
      }
    }
  };

  function renderHome(panel, rows){
    var quoteRows = normalizeHomeQuotes(rows);

    if(!quoteRows.length){
      renderEmpty(panel, 'No quote set for today.');
      return;
    }

    if(!panel.querySelector('.quote-card') || !panel.querySelector('.quote-controls')){
      panel.innerHTML = '';
    }

    homeQuoteRotator.panel = panel;
    homeQuoteRotator.rows = quoteRows;
    homeQuoteRotator.start(panel, quoteRows);
  }

  function renderTableIntoPanels(table){
    var entry = store[table];

    var dependentTabs = TABS.filter(function(tab){
      return tab.table === table;
    });

    dependentTabs.forEach(function(tab){
      var panel = document.getElementById('sys-panel-' + tab.id);
      panel.setAttribute('data-table', table);
      panel.innerHTML = '';

      var head = document.createElement('div');
      head.className = 'panel-head';

      var heading = document.createElement('h2');
      heading.textContent = tab.label;
      head.appendChild(heading);

      if(entry.status === 'ready' && table !== 'home'){
        var count = document.createElement('span');
        count.className = 'count';
        head.appendChild(count);
      }

      panel.appendChild(head);

      if(entry.status === 'loading'){
        renderSkeleton(panel, table === 'home' ? 2 : 4);
        return;
      }

      if(entry.status === 'error'){
        renderError(panel, entry.error);
        return;
      }

      var rows = entry.rows || [];

      if(tab.filter){
        rows = rows.filter(tab.filter);
      }

      if(table === 'home'){
        renderHome(panel, rows);
      }else{
        var countEl = panel.querySelector('.count');

        if(countEl){
          countEl.textContent =
            rows.length + (rows.length === 1 ? ' link' : ' links');
        }

          if(tab.id === 'ims-cf'){
            renderNestedLocationFilters(panel, rows);
          }

        renderLinkCards(panel, rows);
      }
    });
  }

  function fetchTable(table){
    store[table].status = 'loading';
    store[table].error = null;
    renderTableIntoPanels(table);

    var query = supabase
      .from(table)
      .select('*');

    if(table === 'home'){
      query = query.order('created_at', { ascending: true });
    }

    return query
      .then(function(res){
        if(res.error){
          store[table].status = 'error';
          store[table].error = res.error.message || 'Request failed';
        }else{
          store[table].status = 'ready';
          store[table].rows = res.data || [];
        }

        renderTableIntoPanels(table);
      })
      .catch(function(err){
        store[table].status = 'error';
        store[table].error = err && err.message
          ? err.message
          : 'Network error';

        renderTableIntoPanels(table);
      });
  }

  function animateHomeHero(){
    var heroContent = document.getElementById('hero-content');
    if(!heroContent){ return; }

    var heading = heroContent.querySelector('h1');
    var paragraph = heroContent.querySelector('.lede');
    var actions = heroContent.querySelectorAll('.btn-primary, .btn-secondary');

    if(heading){
      var words = heading.textContent.trim().split(/\s+/);
      heading.textContent = '';
      words.forEach(function(word, index){
        var span = document.createElement('span');
        span.className = 'hero-word';
        span.textContent = word;
        span.style.display = 'inline-block';
        span.style.opacity = 0;
        span.style.transform = 'translateY(16px)';
        span.style.filter = 'blur(10px)';
        heading.appendChild(span);
        heading.appendChild(document.createTextNode(' '));
      });

      var wordNodes = heading.querySelectorAll('.hero-word');
      gsap.to(wordNodes, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.06,
        delay: 0.1
      });

      heading.classList.add('floating-mid');
    }

    if(paragraph){
      gsap.fromTo(paragraph, { opacity: 0, y: 16, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power2.out', delay: 0.25 });
      paragraph.classList.add('floating-slow');
    }

    gsap.fromTo(actions, { opacity: 0, y: 16, scale: 0.98, filter: 'blur(8px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power2.out', stagger: 0.08, delay: 0.35 });
  }

  function transitionToView(nextView, callback){
    var currentView = homeView.style.display === 'none' ? appView : homeView;
    var targetView = nextView === 'home' ? homeView : appView;

    if(currentView === targetView){
      if(callback){ callback(); }
      return;
    }

    homeView.style.display = '';
    appView.style.display = '';

    gsap.set(currentView, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' });
    gsap.set(targetView, { opacity: 0, y: 18, scale: 0.985, filter: 'blur(12px)' });

    gsap.to(currentView, {
      opacity: 0,
      y: -18,
      scale: 0.985,
      filter: 'blur(12px)',
      duration: 0.42,
      ease: 'power2.inOut',
      onComplete: function(){
        currentView.style.display = 'none';
        targetView.style.display = '';
        gsap.fromTo(targetView, { opacity: 0, y: 18, scale: 0.985, filter: 'blur(12px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.65, ease: 'power3.out', onComplete: callback || function(){} });
      }
    });
  }

  function showHome(){
    activeTabId = null;
    homeQuoteRotator.stop();
    if(window.heroParticlesResume){
      window.heroParticlesResume();
    }
    transitionToView('home', function(){
      homeView.style.display = '';
      appView.style.display = 'none';
      heroTaglineReady.then(function(){
        animateHomeHero();
        if(store.home && store.home.rows && store.home.rows.length){
          homeQuoteRotator.start(document.getElementById('sys-panel-home') || homeView, store.home.rows);
        }
        closeMenu();
      });
    });
  }

  function showApp(tabId){
    var tab = TAB_BY_ID[tabId];

    if(!tab){
      tab = TABS[0];
    }

    activeTabId = tab.id;
    appTitle.textContent = tab.label;
    homeQuoteRotator.stop();
    if(window.heroParticlesPause){
      window.heroParticlesPause();
    }

    transitionToView('app', function(){
      homeView.style.display = 'none';
      appView.style.display = 'block';
      setActiveTabUI(tab.id);

      if(!fetched[tab.table]){
        fetched[tab.table] = true;
        fetchTable(tab.table);
      }

      closeMenu();
      window.scrollTo(0, 0);
    });
  }

  function navigateTo(tabId){
    if(location.hash === '#' + tabId){
      showApp(tabId);
    }else{
      location.hash = tabId;
    }
  }

  function routeFromHash(){
    var id = location.hash.replace('#', '');

    if(id && TAB_BY_ID[id]){
      showApp(id);
    }else{
      showHome();
    }
  }

  function closeMenu(){
    openMenuKey = null;
    megaMenu.classList.remove('open');

    Array.prototype.forEach.call(navLinks.children, function(el){
      el.classList.remove('menu-open');
    });
  }

  function closeMobileNav(){
    if(!mobileNav){ return; }

    mobileNav.classList.remove('open');
    mobileNav.setAttribute('aria-hidden', 'true');
    if(navToggle){
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Open navigation');
    }
  }

  function renderMobileNav(){
    if(!mobileNavSections){ return; }

    Object.keys(MENUS).forEach(function(key){
      var def = MENUS[key];
      var section = document.createElement('div');
      section.className = 'mobile-nav-section';

      var sectionButton = document.createElement('button');
      sectionButton.type = 'button';
      sectionButton.className = 'mobile-nav-heading';
      sectionButton.textContent = def.title;
      sectionButton.setAttribute('aria-expanded', 'false');

      var submenu = document.createElement('div');
      submenu.className = 'mobile-nav-submenu';

      def.items.forEach(function(item){
        var link = document.createElement('a');
        link.className = 'mobile-nav-link';
        link.href = '#' + item.tab;
        link.textContent = item.label;
        link.addEventListener('click', function(e){
          e.preventDefault();
          navigateTo(item.tab);
          closeMobileNav();
        });
        submenu.appendChild(link);
      });

      sectionButton.addEventListener('click', function(){
        var isOpen = section.classList.toggle('open');
        sectionButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      section.appendChild(sectionButton);
      section.appendChild(submenu);
      mobileNavSections.appendChild(section);
    });
  }

  function openMenu(key, itemEl){
    var def = MENUS[key];

    if(!def){
      return;
    }

    openMenuKey = key;
    megaInner.innerHTML = '';

    def.items.forEach(function(item){
      var link = document.createElement('a');
      link.href = '#' + item.tab;
      link.className = 'mega-link';
      link.textContent = item.label;

      link.addEventListener('click', function(e){
        e.preventDefault();
        navigateTo(item.tab);
      });

      megaInner.appendChild(link);
    });

    megaMenu.classList.add('open');

    Array.prototype.forEach.call(navLinks.children, function(el){
      el.classList.toggle('menu-open', el === itemEl);
    });
  }

  window.addEventListener('hashchange', routeFromHash);

  brandHome.addEventListener('click', function(e){
    e.preventDefault();

    if(location.hash){
      location.hash = '';
    }else{
      showHome();
    }
  });

  appBack.addEventListener('click', function(){
    if(location.hash){
      location.hash = '';
    }else{
      showHome();
    }
  });

  if(viewOrdersBtn){
    viewOrdersBtn.addEventListener('click', function(){
      navigateTo('ims-po');
    });
  }

  if(navToggle){
    navToggle.addEventListener('click', function(){
      var isOpen = mobileNav.classList.toggle('open');
      mobileNav.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });
  }

  if(searchFab){
    searchFab.addEventListener('click', function(){
      if(searchPanel.classList.contains('open')){
        closeSearch();
      }else{
        openSearch();
      }
    });
  }

  if(searchInput){
    searchInput.addEventListener('focus', function(){
      startSearchDataLoad().then(refreshSearchResults);
      refreshSearchResults();
    });

    searchInput.addEventListener('input', function(){
      startSearchDataLoad().then(refreshSearchResults);
      refreshSearchResults();
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(refreshSearchResults, 150);
    });
  }

  renderMobileNav();

  Array.prototype.forEach.call(navLinks.children, function(item){
    var key = item.getAttribute('data-menu');

    item.addEventListener('click', function(){
      if(openMenuKey === key){
        closeMenu();
      }else{
        openMenu(key, item);
      }
    });
  });

  document.addEventListener('click', function(e){
    if(searchPanel.classList.contains('open') &&
       !searchPanel.contains(e.target) &&
       !searchFab.contains(e.target)){
      closeSearch();
    }

    if(!openMenuKey){
      return;
    }

    if(navLinks.contains(e.target) || megaMenu.contains(e.target)){
      return;
    }

    closeMenu();
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      closeMenu();
      closeMobileNav();
      closeSearch();
    }
  });

  routeFromHash();
})();