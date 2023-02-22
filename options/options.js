/*
TODO: additional features
TODO: new promo screenshots
TODO: testing 
TODO: rc 1.1.0
*/

/*Default settings. If there is nothing in storage, use these values.*/

let currentPage = "Everywhere";

/* Popup handlers */
function repopulatePopup(options) {
  if (!options) return;

  const popup = document.getElementById("popup");
  const dropdown = document.getElementById("dropdown");
  const currentPage = dropdown.options[dropdown.selectedIndex].text;

  //clear old fields
  while (popup.firstChild) {
    popup.removeChild(popup.lastChild);
  }

  //add new fields
  Object.keys(options).forEach((page) => {
    if (page === currentPage) {
      Object.keys(options[page]).forEach((item) => {
        // insert toggle field
        const togg = options[page][item];

        const field = togg.show
          ? `<div class="toggle">
                <span class="txt" id=${page + item}>${togg.label}</span>
                <label class="switch switch200">
                  <input type="checkbox" id=${item} data-type=${item} checked>
                  <span class="slider"></span>
                </label>
            </div>`
          : `<div class="toggle">
                <span class="txt" id=${page + item}>${togg.label}</span>
                <label class="switch switch200">
                  <input type="checkbox" id=${item} data-type=${item}>
                  <span class="slider"></span>
                </label>
             </div>`;

        popup.insertAdjacentHTML("afterbegin", field);

        //add event listener
        const el = document.getElementById(item);
        el &&
          el.addEventListener("click", (evt) => {
            let set = storeSettings(item);
            messagePageScript({
              element: item,
              event: evt,
              settings: set
            });
          });

        const te = document.getElementById(page + item);

        te &&
          te.addEventListener("click", (evt) => {
            const e = document.getElementById(item);
            e && e.click();
          });
      });
    }
  });
}

async function storeSettings(changed) {
  /*fires when a button is clicked, syncs local storage */

  let newSettings = await browser.storage.local.get();

  function getChangedOptions() {
    let newOptions = newSettings.options;
    const checkboxes = document.querySelectorAll(".data-types [type=checkbox]");

    if (!checkboxes) {
      return;
    }

    for (let item of checkboxes) {
      if (item.id === changed) {
        newOptions[currentPage][changed]["show"] = item.checked;
      }
    }

    return newOptions;
  }

  const newOptions = getChangedOptions();

  newSettings.options = newOptions;
  browser.storage.local.set(newSettings);
  return newSettings;
}

function updateUI(restoredSettings) {
  /* Update the options UI with the settings values retrieved from storage,
  or the default settings if the stored settings are empty. */

  if (!Object.keys(restoredSettings).length) {
    // there's nothing in the local storage, create default popup
    const { options } = defaultSettings;
    repopulatePopup(options);
  }

  // set UI according to local storage
  repopulatePopup(restoredSettings.options);
}

async function selectionChanged(value) {
  // called in select.js

  if (value != currentPage) {
    const gettingStoredSettings = await browser.storage.local.get();
    updateUI(gettingStoredSettings);
    currentPage = value;
  }
}

/* Content Script handlers */

async function sendMessageToTabs(tabs, msg) {
  for (const tab of tabs) {
    try {
      await browser.tabs.sendMessage(tab.id, JSON.stringify(msg));
      console.log(`🪛 ${msg.element} sent to ${tab.id}`);
    } catch (e) {
      console.error(`Error: ${e}`);
    }
  }
  return true;
}

async function messagePageScript(msg) {
  /*Find all tabs, send a message to the page script.*/
  let tabs = await browser.tabs.query({ url: "*://*.youtube.com/*" });
  let res = await sendMessageToTabs(tabs, msg);
}

async function injectScript() {
  /* inject content script into all yt tabs*/
  try {
    let tabs = await browser.tabs.query({ url: "*://*.youtube.com/*" });

    tabs.forEach(async (t) => {
      const injection = await browser.scripting.executeScript({
        target: { tabId: t.id },
        files: ["defaultSettings.js", "contentscript.js"]
      });
    });
  } catch (error) {
    onError(error);
  }
  return true;
}

(async () => {
  /* On opening the options page, fetch stored settings and update the UI with them.*/

  try {
    /* ip link */
    let icon = document.getElementById("icon");
    icon.addEventListener("click", () => {
      browser.tabs.create({ active: true, url: "https://ko-fi.com/evenzero" });
    });

    /* version display*/
    let ver = document.getElementById("version");
    ver.innerText = "Ver: " + browser.runtime.getManifest().version;

    const gettingStoredSettings = await browser.storage.local.get();

    if (gettingStoredSettings) {
      updateUI(gettingStoredSettings);
    }
    /* inject contentscript */
    await injectScript();
  } catch (err) {
    onError(err);
  }
})();

function onError(e) {
  console.error(e);
}
