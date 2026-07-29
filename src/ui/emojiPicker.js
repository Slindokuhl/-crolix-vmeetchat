/**
 * src/ui/emojiPicker.js
 * Premium emoji picker — self-contained, no dependencies.
 * Inserts at cursor position in any textarea/input.
 */

const RECENT_KEY = "crolix-emoji-recent";
const MAX_RECENT  = 24;

const CATS = [
  { id: "recent",   icon: "🕐", label: "Recent"   },
  { id: "smileys",  icon: "😊", label: "Smileys"  },
  { id: "people",   icon: "👋", label: "People"   },
  { id: "animals",  icon: "🐱", label: "Animals"  },
  { id: "food",     icon: "🍕", label: "Food"     },
  { id: "activity", icon: "⚽", label: "Activity" },
  { id: "travel",   icon: "✈️", label: "Travel"   },
  { id: "objects",  icon: "💡", label: "Objects"  },
  { id: "symbols",  icon: "❤️", label: "Symbols"  },
];

const EMOJIS = {
  smileys: [
    "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇",
    "🥰","😍","🤩","😘","😗","😚","😋","😛","😜","🤪",
    "😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","😏",
    "😒","🙄","😬","🤥","😔","😪","🤤","😴","😷","🤒",
    "🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳",
    "🥸","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮",
    "😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥",
    "😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱",
  ],
  people: [
    "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌",
    "🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆",
    "👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌",
    "🫶","👐","🤲","🙏","✍️","💅","🤳","💪","🦾","🦵",
    "🦶","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👀",
    "👁️","👅","👣","👶","🧒","👦","👧","🧑","👱","🧔",
    "👩","🧓","👴","👵","🧏","💁","🙋","🤦","🤷","💆",
  ],
  animals: [
    "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
    "🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧",
    "🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄",
    "🐝","🪱","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🕷️",
    "🦂","🐢","🐍","🦎","🦖","🦕","🐊","🦦","🦥","🦣",
    "🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂",
    "🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🦤","🦚",
  ],
  food: [
    "🍎","🍊","🍋","🍇","🍓","🫐","🍈","🍒","🍑","🥭",
    "🍍","🥝","🍅","🫒","🥑","🍆","🥦","🥬","🥒","🌶️",
    "🫑","🧄","🧅","🥕","🌽","🍄","🥜","🌰","🍞","🥐",
    "🥖","🥨","🧀","🥚","🍳","🧇","🥞","🧈","🍖","🍗",
    "🥩","🌮","🌯","🫔","🥙","🧆","🥚","🍱","🍣","🍜",
    "🍝","🍲","🍛","🍤","🦐","🦑","🦞","🦀","🦪","🥗",
    "🍰","🎂","🧁","🍩","🍪","🍫","🍬","🍭","🧃","☕",
  ],
  activity: [
    "⚽","🏀","🏈","⚾","🥎","🏐","🏉","🎾","🏸","🥅",
    "⛳","🎯","🎱","🏓","🥊","🥋","🏋️","🤸","⛹️","🤺",
    "🤼","🤾","🏌️","🏇","🧘","🏊","🚴","🏄","🧗","🏆",
    "🥇","🥈","🥉","🎖️","🏅","🎪","🎭","🎨","🎬","🎤",
    "🎵","🎶","🎸","🎹","🎺","🎻","🥁","🎮","🕹️","🎲",
    "🧩","♟️","🎳","🎰","🚵","🤿","🛹","🛷","🥌","🎿",
  ],
  travel: [
    "🚀","✈️","🛸","🚁","🛶","⛵","🚤","🛥️","🛳️","⛴️",
    "🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝",
    "🚞","🚋","🚌","🚍","🚎","🏎️","🚓","🚑","🚒","🚐",
    "🛻","🚚","🚛","🚜","🏍️","🛵","🚲","🛴","🛺","🚗",
    "🗺️","🏔️","⛰️","🌋","🗻","🏕️","🏖️","🏜️","🏝️","🏞️",
    "🌅","🌄","🌠","🎇","🎆","🌇","🌆","🏙️","🌃","🌌",
    "🌉","🌁","🌐","🗼","🗽","🗿","🏛️","⛩️","🕌","🛕",
  ],
  objects: [
    "💻","🖥️","🖨️","⌨️","🖱️","📱","☎️","📺","📷","📸",
    "📹","🎥","🔦","💡","🔋","🔌","💿","📀","🧲","🛠️",
    "🔧","🔨","⚒️","🪛","🔩","⚙️","🪤","🧰","🪣","🪜",
    "🔑","🗝️","🔐","🔒","🔓","📦","📫","📪","📬","📭",
    "📮","🗳️","✏️","✒️","🖊️","📝","📌","📍","📎","🖇️",
    "📏","📐","✂️","🗃️","🗂️","📁","📂","🗄️","🗑️","📋",
    "📊","📈","📉","📑","📓","📔","📒","📕","📗","📘",
  ],
  symbols: [
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
    "❣️","💕","💞","💓","💗","💖","💘","💝","💟","💯",
    "✅","❎","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪",
    "🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🔲","🔳",
    "☑️","⚡","🌟","⭐","✨","💥","🔥","🌈","💦","💧",
    "❄️","🌊","🎉","🎊","🎀","🎁","🏷️","🔔","🔕","📣",
    "♻️","⚜️","🔱","📛","🔰","⭕","❌","⁉️","‼️","💬",
  ],
};

export class EmojiPicker {
  constructor() {
    this._el        = null;
    this._targetEl  = null;
    this._activeCat = "smileys";
    this._outsideH  = null;
  }

  /** Show/toggle the picker anchored to anchorEl, inserting into targetEl */
  toggle(targetEl, anchorEl) {
    if (this._el) { this.hide(); return; }
    this._targetEl = targetEl;
    this._show(anchorEl);
  }

  show(targetEl, anchorEl) {
    this.hide();
    this._targetEl = targetEl;
    this._show(anchorEl);
  }

  hide() {
    if (!this._el) return;
    this._el.classList.remove("ep-open");
    const ref = this._el;
    setTimeout(() => { if (ref.parentNode) ref.remove(); }, 200);
    this._el = null;
    if (this._outsideH) { document.removeEventListener("mousedown", this._outsideH); this._outsideH = null; }
  }

  _show(anchorEl) {
    const el = document.createElement("div");
    el.className = "ep-picker";
    el.innerHTML = this._buildHtml();
    document.body.appendChild(el);
    this._el = el;

    this._position(anchorEl);
    requestAnimationFrame(() => el.classList.add("ep-open"));
    this._bind(el);

    setTimeout(() => {
      this._outsideH = (e) => {
        if (!el.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) this.hide();
      };
      document.addEventListener("mousedown", this._outsideH);
    }, 0);
  }

  _position(anchorEl) {
    const el = this._el;
    const rect = anchorEl.getBoundingClientRect();
    const pickerH = 380;
    const pickerW = 320;
    let top = rect.top - pickerH - 8;
    let left = rect.left + rect.width / 2 - pickerW / 2;

    if (top < 8) top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;

    el.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${pickerW}px;z-index:999999;`;
  }

  _buildHtml() {
    const tabsHtml = CATS.map(c => `
      <button class="ep-tab ${c.id === this._activeCat ? "ep-tab-active" : ""}" data-cat="${c.id}" title="${c.label}">
        <span>${c.icon}</span>
      </button>`).join("");

    return `
<div class="ep-header">
  <div class="ep-search-wrap">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="ep-search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" class="ep-search" id="epSearch" placeholder="Search emoji…" autocomplete="off" spellcheck="false" />
  </div>
  <div class="ep-tabs" id="epTabs">${tabsHtml}</div>
</div>
<div class="ep-grid-wrap">
  <div class="ep-cat-label" id="epCatLabel">${this._catLabel()}</div>
  <div class="ep-grid" id="epGrid">${this._buildGrid(this._activeCat)}</div>
</div>`;
  }

  _catLabel() {
    return CATS.find(c => c.id === this._activeCat)?.label || "";
  }

  _buildGrid(catId, query = "") {
    let emojis;
    if (query) {
      emojis = Object.values(EMOJIS).flat().filter(e => {
        const name = EMOJI_NAMES[e] || "";
        return name.toLowerCase().includes(query.toLowerCase());
      });
    } else if (catId === "recent") {
      emojis = this._getRecent();
    } else {
      emojis = EMOJIS[catId] || [];
    }

    if (emojis.length === 0) {
      return `<div class="ep-empty">${query ? 'No results for "' + query + '"' : "No recent emojis yet"}</div>`;
    }
    return emojis.map(e =>
      `<button class="ep-emoji" data-emoji="${e}" title="${EMOJI_NAMES[e] || e}">${e}</button>`
    ).join("");
  }

  _bind(el) {
    const searchEl = el.querySelector("#epSearch");
    const gridEl   = el.querySelector("#epGrid");
    const labelEl  = el.querySelector("#epCatLabel");
    const tabsEl   = el.querySelector("#epTabs");

    searchEl.addEventListener("input", () => {
      const q = searchEl.value.trim();
      gridEl.innerHTML = this._buildGrid(this._activeCat, q);
      labelEl.textContent = q ? `Results for "${q}"` : this._catLabel();
    });

    tabsEl.addEventListener("click", (e) => {
      const tab = e.target.closest(".ep-tab");
      if (!tab) return;
      this._activeCat = tab.dataset.cat;
      tabsEl.querySelectorAll(".ep-tab").forEach(t => t.classList.toggle("ep-tab-active", t === tab));
      searchEl.value = "";
      labelEl.textContent = this._catLabel();
      gridEl.innerHTML = this._buildGrid(this._activeCat);
    });

    gridEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".ep-emoji");
      if (!btn) return;
      const emoji = btn.dataset.emoji;
      this._insertEmoji(emoji);
      this._addRecent(emoji);
      // Briefly highlight
      btn.classList.add("ep-emoji-flash");
    });
  }

  _insertEmoji(emoji) {
    const el = this._targetEl;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    el.value = el.value.slice(0, start) + emoji + el.value.slice(end);
    const pos = start + [...emoji].length; // handle multi-codepoint emoji
    el.focus();
    el.setSelectionRange(pos, pos);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  _getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
    catch { return []; }
  }

  _addRecent(emoji) {
    const list = this._getRecent().filter(e => e !== emoji);
    list.unshift(emoji);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  }
}

/* Minimal name map for search — covers common emojis */
const EMOJI_NAMES = {
  "😀":"grinning","😃":"smiley","😄":"smile","😁":"grin","😆":"laughing","😅":"sweat smile",
  "😂":"joy","🤣":"rofl","😊":"blush","😇":"innocent","🥰":"smiling hearts","😍":"heart eyes",
  "🤩":"star struck","😘":"kissing heart","😗":"kissing","😚":"kissing closed","😋":"yum",
  "😛":"stuck out tongue","😜":"wink tongue","🤪":"zany","😝":"squinting tongue","🤑":"money mouth",
  "🤗":"hugging","🤭":"hand over mouth","🤫":"shushing","🤔":"thinking","😐":"neutral",
  "😑":"expressionless","😶":"no mouth","😏":"smirk","😒":"unamused","🙄":"eye roll",
  "😬":"grimacing","🤥":"lying","😔":"pensive","😪":"sleepy","🤤":"drooling",
  "😴":"sleeping","😷":"mask","🤒":"thermometer","🤕":"head bandage","🤢":"nauseated",
  "🤮":"vomiting","🥵":"hot","🥶":"cold","😎":"sunglasses","🧐":"monocle",
  "😕":"confused","😟":"worried","😢":"crying","😭":"loudly crying","😱":"screaming",
  "😡":"angry","😠":"mad","😤":"triumph","🥺":"pleading","❤️":"red heart",
  "💙":"blue heart","💚":"green heart","💛":"yellow heart","💜":"purple heart",
  "🖤":"black heart","🤍":"white heart","🤎":"brown heart","💔":"broken heart",
  "💕":"two hearts","💞":"revolving hearts","💯":"100","✅":"check mark","🔥":"fire",
  "⭐":"star","✨":"sparkles","🌟":"glowing star","🎉":"party popper","🎊":"confetti",
  "🙏":"folded hands","👋":"waving hand","👍":"thumbs up","👎":"thumbs down",
  "👏":"clapping","🤝":"handshake","💪":"flexed biceps","🎵":"musical note",
  "🎶":"musical notes","🎤":"microphone","🎸":"guitar","💻":"laptop","📱":"phone",
  "⚽":"soccer","🏀":"basketball","🎮":"video game","🍕":"pizza","🍔":"burger",
  "🍎":"apple","🍊":"orange","🍋":"lemon","🍇":"grapes","🍓":"strawberry",
  "☕":"coffee","🚀":"rocket","✈️":"airplane","🌈":"rainbow","💦":"water",
  "❄️":"snowflake","🌊":"wave","🐶":"dog","🐱":"cat","🐻":"bear","🦁":"lion",
  "🐯":"tiger","🦊":"fox","🐼":"panda","🐨":"koala","🐸":"frog","🐵":"monkey",
};
