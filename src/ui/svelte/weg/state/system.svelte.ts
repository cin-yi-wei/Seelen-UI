import { SeelenWegSide } from "@seelen-ui/lib/types";
import { currentMonitorId, monitors, mousePos } from "./getters.svelte.ts";

const _currentMonitor = $derived.by(() => {
  // 顯示器 ID 可能瞬間對不上（例如全螢幕/GPU 切換時，Windows 把真實 ID 換成
  // SIMULATED_... 再換回來）。找不到就退回主螢幕、再退回第一顆，絕不能拋例外——
  // 一拋就會把讀 .rect 的 autohide 反應式邏輯打死，dock 卡在隱藏。
  return monitors.value.find((m) => m.id === currentMonitorId) ??
    monitors.value.find((m) => m.isPrimary) ??
    monitors.value[0]!;
});

const _mouseAtEdge = $derived.by((): SeelenWegSide | null => {
  const box = _currentMonitor.rect;
  const x = mousePos.value.x;
  const y = mousePos.value.y;

  if (x < box.left || x > box.right || y < box.top || y > box.bottom) {
    return null;
  }

  if (y === box.top) return SeelenWegSide.Top;
  if (x === box.left) return SeelenWegSide.Left;
  if (y === box.bottom - 1) return SeelenWegSide.Bottom;
  if (x === box.right - 1) return SeelenWegSide.Right;

  return null;
});

class SystemState {
  get currentMonitor() {
    return _currentMonitor;
  }

  get mouseAtEdge(): SeelenWegSide | null {
    return _mouseAtEdge;
  }
}

export const systemState = new SystemState();
