// DSA Patterns App Logic - Responsive Zoomable/Collapsible Organic Tree Mind-Map

document.addEventListener("DOMContentLoaded", () => {
  // 1. Core State
  let masteredPatterns = new Set();
  let activePathNodes = new Set(); // Stores path of selected nodes for glowing curves
  
  // Zoom & Pan Coordinates
  const container = document.getElementById("mindmapContainer");
  const canvas = document.getElementById("mindmapCanvas");
  const treeWrapper = document.getElementById("mindmapTreeWrapper");
  const mindmapSvg = document.getElementById("mindmapSvg");
  const patternsList = document.getElementById("patternsList");
  const searchInput = document.getElementById("searchInput");
  
  // Progress Ring & Stats
  const globalMasteredCount = document.getElementById("globalMasteredCount");
  const masteryPercentText = document.getElementById("masteryPercentText");
  const progressBarFill = document.getElementById("progressBarFill");
  const progressBarPercent = document.getElementById("progressBarPercent");
  const circleProgressFill = document.getElementById("circleProgressFill");
  const circleProgressText = document.getElementById("circleProgressText");

  // Detail Drawer
  const drawerOverlay = document.getElementById("drawerOverlay");
  const drawerContent = document.getElementById("drawerContent");
  const closeDrawerBtn = document.getElementById("closeDrawerBtn");
  const drawerCategory = document.getElementById("drawerCategory");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerDescription = document.getElementById("drawerDescription");
  const drawerProblems = document.getElementById("drawerProblems");
  const drawerCode = document.getElementById("drawerCode");
  const copyCodeBtn = document.getElementById("copyCodeBtn");

  // Canvas Controls
  const btnZoomIn = document.getElementById("btnZoomIn");
  const btnZoomOut = document.getElementById("btnZoomOut");
  const btnZoomReset = document.getElementById("btnZoomReset");
  const btnExpandAll = document.getElementById("btnExpandAll");
  const btnCollapseAll = document.getElementById("btnCollapseAll");

  let zoomScale = 0.65; // Zoom out slightly on load to show entire massive tree
  let panX = -200;      // Shift to center the massive mind-map initially
  let panY = -2300;
  let isDragging = false;
  let startX = 0, startY = 0;

  // DOM node mapping to support transition animations
  const nodeDomMap = new Map();

  // Color RGB mapping for glowing category cards
  const colorRgbMap = {
    "#8B5CF6": "139, 92, 246",
    "#EC4899": "236, 72, 153",
    "#3B82F6": "59, 130, 246",
    "#14B8A6": "20, 184, 166",
    "#F97316": "249, 115, 22",
    "#F59E0B": "245, 158, 11",
    "#EF4444": "239, 68, 68",
    "#7C3AED": "124, 58, 237",
    "#059669": "5, 150, 105",
    "#854D0E": "133, 77, 14",
    "#9A3412": "154, 52, 18",
    "#64748B": "100, 116, 139",
    "#D946EF": "217, 70, 239",
    "#475569": "71, 85, 105",
    "#0D9488": "13, 148, 136"
  };

  // Search & Filter state
  let searchQ = "";
  let difficultyFilter = "all"; 
  let statusFilter = "all"; 
  let selectedCategory = "all"; 

  // 2. Setup Zoom & Pan transforms
  const updateCanvasTransform = () => {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
  };

  // Drag Panning
  container.addEventListener("mousedown", (e) => {
    if (e.target.closest(".tree-node") || e.target.closest(".central-node") || e.target.closest(".canvas-controls") || e.target.closest(".control-btn")) return;
    
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    container.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateCanvasTransform();
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      container.style.cursor = "grab";
    }
  });

  // Scroll Mouse Panning & Ctrl/Pinch Zooming (SaaS Standard)
  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    
    // Zoom only when Ctrl key is pressed (standard trackpad pinch-zoom or Ctrl+scroll)
    if (e.ctrlKey) {
      const zoomFactor = 1.05;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldScale = zoomScale;
      if (e.deltaY < 0) {
        zoomScale = Math.min(3.0, zoomScale * zoomFactor);
      } else {
        zoomScale = Math.max(0.12, zoomScale / zoomFactor);
      }

      panX = mouseX - (mouseX - panX) * (zoomScale / oldScale);
      panY = mouseY - (mouseY - panY) * (zoomScale / oldScale);
      updateCanvasTransform();
    } else {
      // Natural pan on scroll (Shift key toggles horizontal scrolling)
      if (e.shiftKey) {
        panX -= e.deltaY * 0.85;
      } else {
        panY -= e.deltaY * 0.85;
        panX -= e.deltaX * 0.85;
      }
      updateCanvasTransform();
    }
  }, { passive: false });

  // Floating controls buttons click triggers
  btnZoomIn.addEventListener("click", () => {
    zoomScale = Math.min(3.0, zoomScale * 1.25);
    updateCanvasTransform();
  });

  btnZoomOut.addEventListener("click", () => {
    zoomScale = Math.max(0.12, zoomScale / 1.25);
    updateCanvasTransform();
  });

  btnZoomReset.addEventListener("click", () => {
    zoomScale = 0.65;
    panX = -200;
    panY = -2300;
    updateCanvasTransform();
  });

  // 3. LocalStorage Check persistence
  const loadMasteredState = () => {
    try {
      const stored = localStorage.getItem("dsa-mastered-patterns-organic");
      if (stored) {
        masteredPatterns = new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveMasteredState = () => {
    try {
      localStorage.setItem("dsa-mastered-patterns-organic", JSON.stringify(Array.from(masteredPatterns)));
    } catch (e) {
      console.error(e);
    }
  };

  // 4. Custom Reingold-Tilford Tree Layout Engine
  const calculateSubtreeHeights = (node) => {
    // If node has no visible/expanded children, it takes default leaf card height
    if (!node.children || node.children.length === 0 || node.collapsed) {
      node.subtreeHeight = 70; // card height (42px) + vertical margin spacing (28px)
      return 70;
    }

    let h = 0;
    node.children.forEach(child => {
      h += calculateSubtreeHeights(child);
    });

    node.subtreeHeight = Math.max(70, h);
    return node.subtreeHeight;
  };

  const assignCoordinates = (node, x, yStart) => {
    node.x = x;

    if (!node.children || node.children.length === 0 || node.collapsed) {
      node.y = yStart + 35; // centered in vertical space allocated
      return;
    }

    let currentY = yStart;
    node.children.forEach(child => {
      // Horizontal level columns spaced out by 360px
      assignCoordinates(child, x + 360, currentY);
      currentY += child.subtreeHeight;
    });

    // Parent node Y coordinate is average of its first and last children
    const firstChildY = node.children[0].y;
    const lastChildY = node.children[node.children.length - 1].y;
    node.y = (firstChildY + lastChildY) / 2;
  };

  // 5. Recursive DOM tree render and Bezier connections
  const renderTreeLayout = () => {
    // Virtual Root Node incorporating all 16 categories
    const virtualRoot = {
      name: "DSA Patterns",
      children: window.dsaData.categories,
      collapsed: false
    };

    // 1. Calculate subtree heights
    calculateSubtreeHeights(virtualRoot);

    // 2. Assign absolute coordinates centered vertically in massive canvas space (Y=5000 center)
    const rootX = 400;
    const rootYStart = 5000 - virtualRoot.subtreeHeight / 2;
    assignCoordinates(virtualRoot, rootX, rootYStart);

    // Render central root node manually
    const root = document.getElementById("centralNode");
    if (root) {
      root.style.left = `${virtualRoot.x}px`;
      root.style.top = `${virtualRoot.y - 28}px`; // center node vertical offset
      
      // Reset active filters when user clicks on central root node
      if (!root.dataset.hasListener) {
        root.dataset.hasListener = "true";
        root.addEventListener("click", () => {
          selectedCategory = "all";
          activePathNodes.clear();
          updateCategoryIndicator();
          renderPatterns();
          renderTreeLayout();
        });
      }
    }

    // Compile set of all visible nodes to identify which ones to prune
    const visibleNodesSet = new Set();
    const connectionsList = []; // Holds arrays of [parent, child, color, isActive] to draw curves

    const collectNodes = (node, parentNode, level, catColor) => {
      visibleNodesSet.add(node);
      
      const currColor = level === 0 ? node.color : catColor;
      
      if (parentNode) {
        const isActivePath = activePathNodes.has(node.name) && activePathNodes.has(parentNode.name);
        connectionsList.push({
          parent: parentNode,
          child: node,
          color: currColor,
          isActive: isActivePath
        });
      }

      if (node.children && !node.collapsed) {
        node.children.forEach(child => {
          collectNodes(child, node, level + 1, currColor);
        });
      }
    };

    // Traverse visible branches starting from virtual root children (categories)
    virtualRoot.children.forEach(cat => {
      collectNodes(cat, virtualRoot, 0, cat.color);
    });

    // 3. Render or update DOM elements for visible nodes
    visibleNodesSet.forEach(node => {
      let element = nodeDomMap.get(node);

      if (!element) {
        // Create new Node DOM card
        element = document.createElement("div");
        element.className = "tree-node";
        
        // Find parent's coordinates to animate/grow outwards from parent!
        const parentNode = findParentNode(node, virtualRoot);
        const startX = parentNode ? parentNode.x : virtualRoot.x;
        const startY = parentNode ? parentNode.y : virtualRoot.y;
        
        element.style.left = `${startX}px`;
        element.style.top = `${startY - 21}px`;
        element.style.opacity = "0";

        // Assign levels styles
        const depth = getNodeDepth(node, virtualRoot);
        element.classList.add(`level-${depth}`);

        // Build internal HTML structure
        populateNodeHTML(element, node, catColorOfNode(node, virtualRoot));

        // Add event listener click drill downs
        element.addEventListener("click", (e) => {
          // Skip if clicking completion checks
          if (e.target.closest(".mastery-checkbox-wrapper") || e.target.tagName === "INPUT" || e.target.closest(".checkmark")) return;

          if (node.isPattern) {
            // Highlight path leading to this pattern
            highlightActivePath(node, virtualRoot);
            openPatternDrawer(node, catNameOfNode(node), catColorOfNode(node, virtualRoot));
            return;
          }

          // Highlight path leading to this category/subcategory node
          highlightActivePath(node, virtualRoot);

          // Update active selected category filters
          selectedCategory = node.name;
          updateCategoryIndicator(node);
          renderPatterns();

          // Toggle collapse/expand on branch nodes
          node.collapsed = !node.collapsed;
          
          // Re-render
          renderTreeLayout();
        });

        treeWrapper.appendChild(element);
        nodeDomMap.set(node, element);
      }

      // Transition to final absolute coordinates
      // Bounded card dimensions: width=260px, height=42px (so top offset = y - 21px)
      setTimeout(() => {
        element.style.left = `${node.x}px`;
        element.style.top = `${node.y - 21}px`;
        element.style.opacity = "1";
        
        // Sync active check styling dynamically
        const arrow = element.querySelector(".node-toggle-btn");
        if (arrow) {
          if (node.collapsed) arrow.classList.add("collapsed");
          else arrow.classList.remove("collapsed");
        }

        // Toggle glowing active path state
        if (activePathNodes.has(node.name)) {
          element.classList.add("active-path");
        } else {
          element.classList.remove("active-path");
        }
      }, 20);
    });

    // 4. Prune/Remove collapsed/invisible elements
    nodeDomMap.forEach((element, node) => {
      if (!visibleNodesSet.has(node)) {
        // Find parent's coordinates to collapse inwards smoothly!
        const parentNode = findParentNode(node, virtualRoot);
        const endX = parentNode ? parentNode.x : virtualRoot.x;
        const endY = parentNode ? parentNode.y : virtualRoot.y;

        element.style.left = `${endX}px`;
        element.style.top = `${endY - 21}px`;
        element.style.opacity = "0";
        
        setTimeout(() => {
          element.remove();
        }, 400); // match transition timeline

        nodeDomMap.delete(node);
      }
    });

    // 5. Redraw connection Bezier curves
    // Clear SVG viewport
    const svgPaths = mindmapSvg.querySelectorAll(".connector-line");
    svgPaths.forEach(p => p.remove());

    connectionsList.forEach(conn => {
      drawBezierConnection(conn.parent, conn.child, conn.color, conn.isActive);
    });
  };

  // Populate inner node markup depending on levels/types
  const populateNodeHTML = (element, node, color) => {
    element.style.setProperty("--node-color", color);
    const rgb = colorRgbMap[color] || "139, 92, 246";
    element.style.setProperty("--node-color-rgb", rgb);

    let innerContent = "";

    if (node.isPattern) {
      const checkState = masteredPatterns.has(node.id) ? "checked" : "";
      element.classList.add("is-pattern");
      if (masteredPatterns.has(node.id)) element.classList.add("mastered");

      innerContent = `
        <div class="mastery-checkbox-wrapper" data-pat-id="${node.id}">
          <input type="checkbox" class="mastery-checkbox" ${checkState}>
          <span class="checkmark"></span>
        </div>
        <div class="node-title-group" style="padding-left: 8px;">
          <span>${node.name}</span>
        </div>
      `;
    } else {
      element.classList.add("has-children");
      innerContent = `
        <div class="node-title-group">
          <span class="node-dot-indicator"></span>
          <span>${node.name}</span>
        </div>
        <button class="node-toggle-btn ${node.collapsed ? "collapsed" : ""}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      `;
    }

    element.innerHTML = innerContent;

    // Attach checkbox changes
    if (node.isPattern) {
      const checkbox = element.querySelector(".mastery-checkbox");
      const wrapper = element.querySelector(".mastery-checkbox-wrapper");
      
      wrapper.addEventListener("click", (e) => e.stopPropagation());
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          masteredPatterns.add(node.id);
          element.classList.add("mastered");
        } else {
          masteredPatterns.delete(node.id);
          element.classList.remove("mastered");
        }
        saveMasteredState();
        updateProgressStats();
        renderPatterns();
      });
    }
  };

  // Draw Bezier curves connecting parent right edge to child left edge
  const drawBezierConnection = (parent, child, color, isActive) => {
    const parentWidth = parent.name === "DSA Patterns" ? 240 : 260;
    const childWidth = 260;

    const xStart = parent.x + parentWidth;
    const yStart = parent.y;
    
    const xEnd = child.x;
    const yEnd = child.y;

    const controlX = xStart + (xEnd - xStart) * 0.45;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${xStart} ${yStart} C ${controlX} ${yStart}, ${controlX} ${yEnd}, ${xEnd} ${yEnd}`);
    path.setAttribute("class", `connector-line ${isActive ? "active" : ""}`);
    
    if (isActive) {
      path.setAttribute("stroke", color);
    } else {
      path.setAttribute("stroke", "rgba(107, 114, 128, 0.25)");
    }
    path.style.color = color;
    mindmapSvg.appendChild(path);
  };

  // Highlight connections trail leading to pattern
  const highlightActivePath = (targetPattern, virtualRoot) => {
    activePathNodes.clear();
    
    const findPath = (node, path) => {
      path.push(node.name);
      if (node.id === targetPattern.id || (!targetPattern.id && node.name === targetPattern.name)) return true;
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          if (findPath(node.children[i], path)) return true;
        }
      }
      path.pop();
      return false;
    };

    virtualRoot.children.forEach(cat => {
      const path = [virtualRoot.name];
      if (findPath(cat, path)) {
        path.forEach(name => activePathNodes.add(name));
      }
    });

    // Re-render layout to apply glowing active path CSS classes & SVG properties
    renderTreeLayout();
  };

  // 6. Tree recursive helper search utilities
  const findParentNode = (targetChild, parentNode) => {
    if (parentNode.children) {
      if (parentNode.children.includes(targetChild)) return parentNode;
      for (let i = 0; i < parentNode.children.length; i++) {
        const found = findParentNode(targetChild, parentNode.children[i]);
        if (found) return found;
      }
    }
    return null;
  };

  const getNodeDepth = (target, parentNode, currDepth = 0) => {
    if (parentNode === target) return currDepth;
    if (parentNode.children) {
      if (parentNode.children.includes(target)) return currDepth;
      for (let i = 0; i < parentNode.children.length; i++) {
        const found = getNodeDepth(target, parentNode.children[i], currDepth + 1);
        if (found !== -1) return found;
      }
    }
    return -1;
  };

  const catColorOfNode = (node, virtualRoot) => {
    let parent = node;
    while (parent) {
      const gParent = findParentNode(parent, virtualRoot);
      if (gParent === virtualRoot) return parent.color;
      parent = gParent;
    }
    return "#8B5CF6";
  };

  const catNameOfNode = (node) => {
    const virtualRoot = { name: "DSA Patterns", children: window.dsaData.categories };
    let parent = node;
    while (parent) {
      const gParent = findParentNode(parent, virtualRoot);
      if (gParent === virtualRoot) return parent.name;
      parent = gParent;
    }
    return "Array";
  };

  // 7. Global counts and expand-all controllers
  const getTotalPatternsCount = () => {
    let count = 0;
    const recurse = (node) => {
      if (node.isPattern) count++;
      if (node.children) node.children.forEach(recurse);
    };
    window.dsaData.categories.forEach(cat => {
      cat.children.forEach(recurse);
    });
    return count;
  };

  // Expand All / Collapse All buttons operations
  btnExpandAll.addEventListener("click", () => {
    const recurse = (node) => {
      if (node.children) {
        node.collapsed = false;
        node.children.forEach(recurse);
      }
    };
    window.dsaData.categories.forEach(recurse);
    renderTreeLayout();
  });

  btnCollapseAll.addEventListener("click", () => {
    const recurse = (node) => {
      if (node.children) {
        node.collapsed = true;
        node.children.forEach(recurse);
      }
    };
    window.dsaData.categories.forEach(recurse);
    renderTreeLayout();
  });

  // 8. Progress stats rendering
  const updateProgressStats = () => {
    const total = getTotalPatternsCount();
    const completed = masteredPatterns.size;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Header progress text
    globalMasteredCount.textContent = `${completed} / ${total}`;
    masteryPercentText.textContent = `${percent}%`;

    // Horizontal progress fill
    progressBarFill.style.width = `${percent}%`;
    progressBarPercent.textContent = `${completed} of ${total} Completed (${percent}%)`;

    // Circular progress ring
    const circ = 188.5; // circumference
    const offset = circ - (percent / 100) * circ;
    circleProgressFill.style.strokeDashoffset = offset;
    circleProgressText.textContent = `${percent}%`;
  };

  // Update Category title count
  const updateCategoryIndicator = (node) => {
    if (!node || node.name === "DSA Patterns") {
      selectedCategoryTitle.innerHTML = `
        <span class="category-indicator-pill" style="background-color: var(--color-purple);"></span>
        All Categories
      `;
      selectedCategoryCount.textContent = getTotalPatternsCount();
      selectedCategoryCount.style.backgroundColor = "var(--color-purple)";
      return;
    }

    // Count patterns inside this category/subcategory subtree
    let count = 0;
    const recurse = (n) => {
      if (n.isPattern) count++;
      if (n.children) n.children.forEach(recurse);
    };
    recurse(node);

    const virtualRoot = { name: "DSA Patterns", children: window.dsaData.categories };
    const color = catColorOfNode(node, virtualRoot);
    selectedCategoryTitle.innerHTML = `
      <span class="category-indicator-pill" style="background-color: ${color};"></span>
      ${node.name}
    `;
    selectedCategoryCount.textContent = count;
    selectedCategoryCount.style.backgroundColor = color;
  };

  // 9. Flat pattern card list explorer updates
  const getFlatPatternsList = () => {
    const list = [];
    const recurse = (node, catName, catColor, path) => {
      const currentPath = [...path, node.name];
      if (node.isPattern) {
        list.push({ ...node, categoryName: catName, categoryColor: catColor, ancestors: currentPath });
      }
      if (node.children) {
        node.children.forEach(c => recurse(c, catName, catColor, currentPath));
      }
    };
    window.dsaData.categories.forEach(cat => {
      cat.children.forEach(c => recurse(c, cat.name, cat.color, [cat.name]));
    });
    return list;
  };

  const renderPatterns = () => {
    patternsList.innerHTML = "";
    let list = getFlatPatternsList();

    // Search Query filters
    if (searchQ) {
      const q = searchQ.toLowerCase().trim();
      list = list.filter(pat => {
        const matchesTitle = pat.name.toLowerCase().includes(q);
        const matchesDesc = pat.desc.toLowerCase().includes(q);
        const matchesProb = pat.problems.some(p => p.toLowerCase().includes(q));
        return matchesTitle || matchesDesc || matchesProb;
      });
    }

    // Difficulty level filters
    if (difficultyFilter !== "all") {
      list = list.filter(pat => pat.difficulty.toLowerCase() === difficultyFilter);
    }

    // Mastery status filters
    if (statusFilter !== "all") {
      if (statusFilter === "mastered") {
        list = list.filter(pat => masteredPatterns.has(pat.id));
      } else if (statusFilter === "unmastered") {
        list = list.filter(pat => !masteredPatterns.has(pat.id));
      }
    }

    // Sort so patterns/problems under the clicked category/subcategory come to the very top!
    if (selectedCategory && selectedCategory !== "all") {
      list.sort((a, b) => {
        const aInSel = a.ancestors && a.ancestors.includes(selectedCategory);
        const bInSel = b.ancestors && b.ancestors.includes(selectedCategory);
        if (aInSel && !bInSel) return -1;
        if (!aInSel && bInSel) return 1;
        return 0;
      });
    }

    // Empty list fallback
    if (list.length === 0) {
      patternsList.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);">
            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p>No matching patterns found.<br>Modify search query or level filters.</p>
        </div>
      `;
      return;
    }

    // Build Cards
    list.forEach(pat => {
      const card = document.createElement("div");
      card.className = "pattern-card";
      card.setAttribute("data-id", pat.id);

      const isCompleted = masteredPatterns.has(pat.id);

      card.innerHTML = `
        <div class="mastery-checkbox-wrapper">
          <input type="checkbox" class="mastery-checkbox" ${isCompleted ? "checked" : ""}>
          <span class="checkmark"></span>
        </div>
        <div class="pattern-content">
          <div class="pattern-card-header">
            <div class="pattern-card-title">${pat.name}</div>
            <div class="badge-row">
              <span class="diff-badge ${pat.difficulty.toLowerCase()}">${pat.difficulty}</span>
              <span class="diff-badge" style="background: rgba(255,255,255,0.03); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.05); font-size: 0.7rem;">${pat.categoryName}</span>
            </div>
          </div>
          <div class="pattern-desc">${pat.desc}</div>
          <div class="pattern-problems-count">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            ${pat.problems.length} Practice Problem${pat.problems.length > 1 ? "s" : ""}
          </div>
        </div>
      `;

      card.addEventListener("click", (e) => {
        if (e.target.closest(".mastery-checkbox-wrapper") || e.target.tagName === "INPUT" || e.target.closest(".checkmark")) {
          return;
        }
        
        // Glow mind-map branch trail leading to pattern
        const virtualRoot = { name: "DSA Patterns", children: window.dsaData.categories };
        highlightActivePath(pat, virtualRoot);
        
        openPatternDrawer(pat, pat.categoryName, pat.categoryColor);
      });

      const checkbox = card.querySelector(".mastery-checkbox");
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          masteredPatterns.add(pat.id);
        } else {
          masteredPatterns.delete(pat.id);
        }
        saveMasteredState();
        updateProgressStats();
        
        // Sync checkmarks state back to mind-map nodes
        const nodeDom = Array.from(nodeDomMap.values()).find(el => el.getAttribute("data-id") === pat.id);
        if (nodeDom) {
          const mapCheck = nodeDom.querySelector(".mastery-checkbox");
          if (mapCheck) mapCheck.checked = checkbox.checked;
          if (checkbox.checked) nodeDom.classList.add("mastered");
          else nodeDom.classList.remove("mastered");
        }
      });

      patternsList.appendChild(card);
    });
  };

  // 10. Drawer Open Detail Panel logic
  const openPatternDrawer = (pat, catName, catColor) => {
    drawerCategory.textContent = catName;
    drawerCategory.style.color = catColor;
    drawerTitle.textContent = pat.name;
    drawerDescription.textContent = pat.desc;

    // Problems practice links
    drawerProblems.innerHTML = "";
    pat.problems.forEach(prob => {
      // Slugify practice link directly (e.g. "LeetCode 1: Two Sum" -> "two-sum")
      const clean = prob.replace(/^LeetCode \d+:\s*/i, "").trim();
      const slug = clean
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // remove punctuation like colons, quotes
        .trim()
        .replace(/[\s-]+/g, "-");    // collapse spaces/hyphens to single hyphen
      
      const link = document.createElement("a");
      link.href = `https://leetcode.com/problems/${slug}/`;
      link.target = "_blank";
      link.className = "problem-link-item";
      link.innerHTML = `
        <span class="problem-name">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-green);">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          ${prob}
        </span>
        <span class="problem-external-icon">🡵</span>
      `;
      drawerProblems.appendChild(link);
    });

    // Snippet code
    drawerCode.textContent = pat.snippet;
    copyCodeBtn.textContent = "Copy Code";
    copyCodeBtn.style.backgroundColor = "";

    // Toggle CSS Drawer classes
    drawerOverlay.classList.add("active");
    drawerContent.classList.add("active");
  };

  const closePatternDrawer = () => {
    drawerOverlay.classList.remove("active");
    drawerContent.classList.remove("active");
  };

  closeDrawerBtn.addEventListener("click", closePatternDrawer);
  drawerOverlay.addEventListener("click", closePatternDrawer);

  copyCodeBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(drawerCode.textContent).then(() => {
      copyCodeBtn.textContent = "Copied!";
      copyCodeBtn.style.backgroundColor = "rgba(16, 185, 129, 0.25)";
      copyCodeBtn.style.borderColor = "var(--color-green)";
      setTimeout(() => {
        copyCodeBtn.textContent = "Copy Code";
        copyCodeBtn.style.backgroundColor = "";
        copyCodeBtn.style.borderColor = "";
      }, 1500);
    });
  });

  // 11. Search inputs & Filtering Event Handlers
  searchInput.addEventListener("input", (e) => {
    searchQ = e.target.value;
    renderPatterns();
  });

  const setupFilterListeners = (containerId, stateVarSetter) => {
    const container = document.getElementById(containerId);
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      container.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      stateVarSetter(btn.getAttribute("data-filter") || btn.getAttribute("data-status"));
      renderPatterns();
    });
  };

  setupFilterListeners("difficultyFilters", (val) => { difficultyFilter = val; });
  setupFilterListeners("statusFilters", (val) => { statusFilter = val; });

  // Initialize collapse states recursively on first startup
  const initTreeStates = () => {
    window.dsaData.categories.forEach(cat => {
      cat.collapsed = true; // Categories collapsed by default on startup!
      
      const recurse = (node) => {
        if (node.children) {
          node.collapsed = true; // Sub-branches collapsed by default
          node.children.forEach(recurse);
        }
      };
      if (cat.children) cat.children.forEach(recurse);
    });
  };

  // 12. Startup Dashboard
  loadMasteredState();
  initTreeStates();
  renderTreeLayout();
  updateCanvasTransform();
  updateCategoryIndicator();
  renderPatterns();
  updateProgressStats();

  // Redraw connections on window resize
  window.addEventListener("resize", () => {
    renderTreeLayout();
  });
});
