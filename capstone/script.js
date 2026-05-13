// ── State ──────────────────────────────────────────────────────────────────
const selected = new Set();

// Manually defined categories mapping ingredient types from TheMealDB
// TheMealDB's /list.php?i=list returns all ingredients; we group them by type
const CATEGORY_KEYWORDS = {
  "Meat & Poultry":  ["chicken","beef","pork","lamb","turkey","duck","veal","bacon","sausage","mince","steak","ribs","ham","venison","goose","mutton"],
  "Seafood":         ["salmon","tuna","shrimp","prawn","cod","tilapia","bass","crab","lobster","scallop","anchovy","sardine","trout","halibut","squid","clam","mussel","oyster","fish","haddock","mackerel"],
  "Vegetables":      ["onion","garlic","tomato","pepper","broccoli","spinach","kale","zucchini","carrot","potato","mushroom","corn","pea","celery","leek","cucumber","eggplant","asparagus","cauliflower","cabbage","beet","lettuce","artichoke","fennel","chard","parsnip","turnip","radish","okra","squash","pumpkin"],
  "Fruits":          ["lemon","lime","orange","apple","banana","berry","mango","pineapple","grape","peach","pear","pomegranate","coconut","avocado","cherry","plum","melon","apricot","fig","date","cranberry","raisin","currant","passion"],
  "Grains & Pasta":  ["rice","pasta","spaghetti","penne","flour","bread","oat","quinoa","couscous","noodle","tortilla","barley","wheat","bulgur","polenta","semolina","rye","cornmeal","farro"],
  "Dairy & Eggs":    ["egg","milk","butter","cream","yogurt","cheese","cheddar","mozzarella","parmesan","feta","ricotta","brie","gouda","mascarpone","ghee"],
  "Herbs & Spices":  ["salt","pepper","cumin","paprika","chili","oregano","basil","thyme","rosemary","bay","turmeric","cinnamon","nutmeg","ginger","cardamom","coriander","cayenne","saffron","dill","parsley","cilantro","mint","sage","tarragon","clove","anise","fennel seed","sumac","allspice","mace","vanilla"],
  "Oils & Sauces":   ["oil","vinegar","soy sauce","fish sauce","worcestershire","hot sauce","ketchup","mustard","mayonnaise","balsamic","sriracha","tahini","oyster sauce","hoisin","teriyaki","pesto","salsa","tabasco"],
  "Pantry Staples":  ["sugar","honey","maple","stock","broth","coconut milk","tomato paste","canned","baking","cornstarch","yeast","molasses","syrup","jam","pickle","miso","anchovy paste"],
  "Nuts & Seeds":    ["almond","walnut","cashew","peanut","pine nut","sesame","sunflower","chia","flax","pumpkin seed","pistachio","pecan","hazelnut","macadamia","chestnut"],
  "Legumes":         ["bean","lentil","chickpea","pea","edamame","tofu","tempeh","hummus","black bean","kidney","cannellini","fava"],
  "Alcohol & Drinks":["wine","beer","brandy","rum","whiskey","vodka","sherry","sake","mirin","coffee","tea"],
};

// ── TheMealDB API ──────────────────────────────────────────────────────────
async function fetchIngredients() {
  const res = await fetch("https://www.themealdb.com/api/json/v1/1/list.php?i=list");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.meals; // array of { idIngredient, strIngredient, strDescription, strType }
}

// ── Categorise ingredients ─────────────────────────────────────────────────
function categorise(ingredients) {
  const cats = {};
  Object.keys(CATEGORY_KEYWORDS).forEach(k => cats[k] = []);
  const other = [];

  ingredients.forEach(({ strIngredient }) => {
    const name = strIngredient.trim();
    const lower = name.toLowerCase();
    let placed = false;
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => lower.includes(kw))) {
        cats[cat].push(name);
        placed = true;
        break;
      }
    }
    if (!placed) other.push(name);
  });

  // Sort each category alphabetically
  Object.keys(cats).forEach(k => cats[k].sort());
  other.sort();

  // Build final array, skip empty cats, append "Other" if needed
  const result = Object.entries(cats)
    .filter(([, items]) => items.length > 0)
    .map(([name, items]) => ({ name, items }));

  if (other.length) result.push({ name: "Other", items: other });
  return result;
}

// ── Selected bar ──────────────────────────────────────────────────────────
function updateSelectedBar() {
  const bar = document.getElementById("selected-bar");
  const label = document.getElementById("sel-label");
  const btn = document.getElementById("cook-btn");

  bar.querySelectorAll(".chip").forEach(c => c.remove());

  if (selected.size === 0) {
    label.style.display = "";
    label.textContent = "No ingredients selected yet";
    btn.disabled = true;
    return;
  }

  label.style.display = "none";
  btn.disabled = false;

  selected.forEach(ing => {
    const chip = document.createElement("span");
    chip.className = "chip";
    const safe = ing.replace(/'/g, "\\'");
    chip.innerHTML = `${ing}<button aria-label="Remove ${ing}" onclick="removeIng('${safe}')">×</button>`;
    bar.insertBefore(chip, btn);
  });
}

function removeIng(name) {
  selected.delete(name);
  document.querySelectorAll(".ing-btn").forEach(b => {
    if (b.dataset.name === name) b.classList.remove("selected");
  });
  updateAllCounts();
  updateSelectedBar();
}

function updateAllCounts() {
  document.querySelectorAll(".category-block").forEach(block => {
    const grid = block.querySelector(".ingredient-grid");
    const countEl = block.querySelector(".cat-count");
    const items = grid.querySelectorAll(".ing-btn");
    const n = Array.from(items).filter(b => b.classList.contains("selected")).length;
    countEl.textContent = n > 0 ? `${n} selected` : `${items.length}`;
    countEl.className = "cat-count" + (n > 0 ? " has-sel" : "");
  });
}

// ── Build menu DOM ─────────────────────────────────────────────────────────
function buildMenu(categories) {
  const menu = document.getElementById("menu");
  menu.innerHTML = "";

  categories.forEach((cat, ci) => {
    const block = document.createElement("div");
    block.className = "category-block";

    const header = document.createElement("div");
    header.className = "category-header";
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", ci === 0 ? "true" : "false");
    header.innerHTML = `
      <span class="cat-name">${cat.name}</span>
      <span class="cat-count" id="count-${ci}">${cat.items.length}</span>
      <span class="chevron${ci === 0 ? " open" : ""}" id="chev-${ci}">▾</span>
    `;

    const grid = document.createElement("div");
    grid.className = "ingredient-grid" + (ci === 0 ? " open" : "");

    cat.items.forEach(ing => {
      const btn = document.createElement("button");
      btn.className = "ing-btn";
      btn.dataset.name = ing;
      btn.textContent = ing;
      btn.addEventListener("click", () => {
        if (selected.has(ing)) {
          selected.delete(ing);
          btn.classList.remove("selected");
          console.log(`❌ Removed: ${ing} | Selected: [${[...selected].join(", ")}]`);
        } else {
          selected.add(ing);
          btn.classList.add("selected");
          console.log(`✅ Added: ${ing} | Selected: [${[...selected].join(", ")}]`);
        }
        updateAllCounts();
        updateSelectedBar();
      });
      grid.appendChild(btn);
    });

    header.addEventListener("click", () => {
      const isOpen = grid.classList.contains("open");
      grid.classList.toggle("open");
      document.getElementById(`chev-${ci}`).classList.toggle("open");
      header.setAttribute("aria-expanded", String(!isOpen));
    });

    block.appendChild(header);
    block.appendChild(grid);
    menu.appendChild(block);
  });
}

// ── Error state ───────────────────────────────────────────────────────────
function showError(msg) {
  document.getElementById("menu").innerHTML = `
    <div class="error-state">
      ⚠️ ${msg}<br>
      <button class="retry-btn" onclick="init()">Try again</button>
    </div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  document.getElementById("menu").innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div class="loading-text">Loading ingredients from TheMealDB...</div>
    </div>`;

  try {
    const raw = await fetchIngredients();
    console.log(`📦 Fetched ${raw.length} ingredients from TheMealDB`);
    const categories = categorise(raw);
    buildMenu(categories);
  } catch (err) {
    console.error("Fetch error:", err);
    showError("Couldn't load ingredients. Check your connection and try again.");
  }
}

// ── Cook button ───────────────────────────────────────────────────────────
document.getElementById("cook-btn").addEventListener("click", async () => {
  const list = [...selected];
  console.log(`🍳 Cook request with: [${list.join(", ")}]`);

  let resultsPanel = document.getElementById("results-panel");
  if (!resultsPanel) {
    resultsPanel = document.createElement("div");
    resultsPanel.id = "results-panel";
    document.querySelector(".main").prepend(resultsPanel);
  }

  resultsPanel.innerHTML = `<div class="results-loading"><div class="spinner"></div><div class="loading-text">Finding recipes for your ingredients...</div></div>`;
  resultsPanel.scrollIntoView({ behavior: "smooth" });

  try {
    const searches = await Promise.all(
      list.slice(0, 3).map(ing =>
        fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ing)}`)
          .then(r => r.json())
          .then(d => d.meals || [])
      )
    );

    const mealCount = {};
    searches.forEach(meals => {
      meals.forEach(meal => {
        mealCount[meal.idMeal] = mealCount[meal.idMeal]
          ? { ...mealCount[meal.idMeal], count: mealCount[meal.idMeal].count + 1 }
          : { ...meal, count: 1 };
      });
    });

    const sorted = Object.values(mealCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (sorted.length === 0) {
      resultsPanel.innerHTML = `<div class="error-state">😔 No recipes found for those ingredients. Try selecting different ones!</div>`;
      return;
    }

    const details = await Promise.all(
      sorted.map(m =>
        fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${m.idMeal}`)
          .then(r => r.json())
          .then(d => d.meals[0])
      )
    );

    resultsPanel.innerHTML = `
      <div class="results-box">
        <h2 class="results-title">Here's what you can make!</h2>
        ${details.map(meal => {
          const ingredients = [];
          for (let i = 1; i <= 20; i++) {
            if (meal[`strIngredient${i}`]) ingredients.push(meal[`strIngredient${i}`]);
          }
          return `
            <div class="result-card">
              <img class="result-img" src="${meal.strMealThumb}/preview" alt="${meal.strMeal}" />
              <div class="result-info">
                <h3 class="result-name">${meal.strMeal}</h3>
                <p class="result-category">🍽 ${meal.strCategory} · ${meal.strArea}</p>
                <p class="result-ingredients"><strong>Needs:</strong> ${ingredients.slice(0, 6).join(", ")}${ingredients.length > 6 ? "..." : ""}</p>
              </div>
            </div>`;
        }).join("")}
        <button class="close-results" onclick="document.getElementById('results-panel').innerHTML=''">✕ Close</button>
      </div>`;
  } catch (err) {
    console.error("Error:", err);
    resultsPanel.innerHTML = `<div class="error-state">⚠️ Couldn't load recipes. Check your connection and try again.<br><button class="retry-btn" onclick="document.getElementById('cook-btn').click()">Try again</button></div>`;
  }
});

// ── Start ─────────────────────────────────────────────────────────────────
init();