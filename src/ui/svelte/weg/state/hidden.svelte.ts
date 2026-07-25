import { HideMode } from "@seelen-ui/lib/types";
import { virtualDesktops } from "./getters.svelte.ts";
import { settingsState } from "./settings.svelte.ts";
import { systemState } from "./system.svelte.ts";
import { windowsState } from "./windows.svelte.ts";
import { isThisWebviewFocused, isTouchPrimary } from "libs/ui/svelte/utils";

const isSwitchingWorkspace = $derived(virtualDesktops.value.switching);

let _hiddenByAutohide = $state(false);
let _isDraggingItem = $state(false);

export const dockShouldBeHidden = {
  get value() {
    return _hiddenByAutohide;
  },
};

export function setDockIsDraggingItem(isDragging: boolean): void {
  _isDraggingItem = isDragging;
}

// 上一次計算出來的「該不該隱藏」決策，僅用來在狀態變化時記一筆 log，方便診斷
// dock 卡在隱藏（例如遊戲/全螢幕的效能模式結束後沒回來）的情況。
let _lastLoggedHidden: boolean | null = null;

$effect.root(() => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const clearPendingTimeout = (): void => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  $effect(() => {
    try {
      if (isSwitchingWorkspace) {
        clearPendingTimeout();
        return;
      }

      const { delayToHide, delayToShow, hideMode, position } = settingsState;
      const isMouseOverEdge = systemState.mouseAtEdge === position;
      const isDockOverlapped = windowsState.isDockOverlapped;
      const thisWebviewFocused = isThisWebviewFocused.value;

      let hidden = false;
      let flush = false;

      switch (hideMode) {
        case HideMode.Never:
          hidden = false;
          flush = true;
          break;
        case HideMode.Always:
          hidden = !isTouchPrimary.value && !thisWebviewFocused && !isMouseOverEdge;
          flush = isTouchPrimary.value;
          break;
        case HideMode.OnOverlap:
          hidden = !isTouchPrimary.value &&
            isDockOverlapped &&
            !thisWebviewFocused &&
            !isMouseOverEdge;
          flush = isTouchPrimary.value;
          break;
      }

      if (_isDraggingItem) {
        hidden = false;
        flush = true;
      }

      // 決策變化時記一筆，附上關鍵輸入，之後看 log 就能判斷 dock 為何卡在隱藏。
      if (hidden !== _lastLoggedHidden) {
        _lastLoggedHidden = hidden;
        console.trace(
          `autohide decision: hidden=${hidden} (mode=${hideMode}, overlapped=${isDockOverlapped}, ` +
            `mouseAtEdge=${isMouseOverEdge}, focused=${thisWebviewFocused}, dragging=${_isDraggingItem})`,
        );
      }

      clearPendingTimeout();

      if (hidden) {
        timeout = setTimeout(() => {
          _hiddenByAutohide = true;
        }, delayToHide);
      } else if (flush) {
        _hiddenByAutohide = false;
      } else {
        timeout = setTimeout(() => {
          _hiddenByAutohide = false;
        }, delayToShow);
      }

      return () => {
        clearPendingTimeout();
      };
    } catch (e) {
      // 保底：自動隱藏的計算若拋例外，絕不能讓 effect 死掉導致 dock 永久隱藏。
      // 一律強制顯示 dock 並記錄錯誤，寧可自動隱藏暫時失效，也不要整條 dock 消失。
      console.error("autohide effect failed; forcing dock visible:", e);
      clearPendingTimeout();
      _hiddenByAutohide = false;
      return;
    }
  });
});
