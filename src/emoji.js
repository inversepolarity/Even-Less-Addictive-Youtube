(async () => {
  // TODO: tighten-up debounced scheduling
  if (typeof browser === "undefined") {
    var browser = chrome;
  }

  const pattern =
    /\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

  let emojishow = true,
    ignoreMutations = false,
    fullClearFirstScheduledTime = 0,
    fullClearTimeout = null,
    totalTime = 0,
    node,
    hashmap = {};

  function scheduleDebouncedFullClear(debounceTimeMs, maxDebounceTimeMs) {
    const scheduled = fullClearTimeout !== null;

    if (scheduled) {
      const timeDiff = Date.now() - fullClearFirstScheduledTime;
      const shouldBlock = timeDiff + debounceTimeMs > maxDebounceTimeMs;
      if (maxDebounceTimeMs && shouldBlock) return;
      clearTimeout(fullClearTimeout);
    } else {
      fullClearFirstScheduledTime = Date.now();
    }
    fullClearTimeout = emojishow
      ? setTimeout(fullClear, debounceTimeMs)
      : setTimeout(fullRestore, debounceTimeMs);
  }

  async function fullClear() {
    const start = Date.now();
    await toggleEmoji(document.body, true);

    totalTime += Date.now() - start;
    fullClearTimeout = null;
  }

  async function fullRestore() {
    const start = Date.now();
    await toggleEmoji(document.body, false);

    totalTime += Date.now() - start;
    fullClearTimeout = null;
  }

  async function toggleEmoji(element, remove) {
    if (!element) return;

    if (remove === undefined) return;

    const treeWalker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
    );

    while ((node = treeWalker.nextNode())) {
      if (node.parentElement.tagName !== "SCRIPT" && node.nodeValue) {
        const matches = node.nodeValue && node.nodeValue.match(pattern);

        if (matches) {
          let strip = node.nodeValue.replace(pattern, "");

          if (!strip.length) {
            strip = " ";
          }

          if (hashmap[node.nodeValue] === undefined) {
            hashmap[node.nodeValue] = {
              orig: node.nodeValue,
              strip,
              nodes: [node.parentElement]
            };
            return;
          }

          if (hashmap[node.nodeValue] != undefined) {
            hashmap[node.nodeValue] = {
              orig: node.nodeValue,
              strip,
              nodes: new Set([
                ...hashmap[node.nodeValue].nodes,
                node.parentElement
              ])
            };
          }

          if (remove && strip != undefined) {
            node.nodeValue = strip;
          }
        }

        if (!emojishow) {
          for (let o = 0; o < Object.keys(hashmap).length; o++) {
            const el = hashmap[Object.keys(hashmap)[o]];
            let nodes = Array.from(el.nodes);
            for (let rn = 0; rn < nodes.length; rn++) {
              const refnode = nodes[rn];
              if (node.nodeValue == el.strip) {
                if (node.parentElement.isSameNode(refnode)) {
                  node.nodeValue = el.orig;
                }
              }
            }
          }
        }
      }
    }
    return;
  }

  async function onMutation(mutations) {
    if (ignoreMutations) return;

    const start = Date.now();

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      for (let j = 0; j < mutation.addedNodes.length; j++) {
        const node = mutation.addedNodes[j];
        ignoreMutations = true;
        await toggleEmoji(node, emojishow);
        ignoreMutations = false;
      }
    }
    totalTime += Date.now() - start;
    scheduleDebouncedFullClear(100, 500);
  }

  MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
  let observer = new MutationObserver(onMutation);

  observer.observe(document, {
    attributes: true,
    childList: true,
    subtree: true
  });

  await browser.runtime.onMessage.addListener(async (request, sender) => {
    const { element } = await JSON.parse(request);
    const { settings } = await browser.storage.local.get();
    const { options } = settings;
    emojishow = options["Everywhere"].emoji.show;

    switch (element) {
      case "emoji":
        emojishow ? fullClear() : fullRestore();
        break;
      default:
        break;
    }
  });
})();
