import type { WorldMapCamera } from './WorldMapCamera';

/** Continuous camera gestures; no world or resident data enters this module. */
export function installWorldMapGestures(
  element: HTMLElement,
  camera: WorldMapCamera,
  changed: () => void
): void {
  const pointers = new Map<number, { x: number; y: number }>();

  let start: { x: number; y: number } | undefined;
  let dragged = false;

  let pinch:
    | {
        distance: number;
        scale: number;
        anchor: { x: number; y: number };
      }
    | undefined;

  let ticking = false;
  let lastEvent: PointerEvent | undefined;

  let pendingDx = 0;
  let pendingDy = 0;

  const local = (x: number, y: number) => {
    const b = element.getBoundingClientRect();

    return {
      x: x - b.left,
      y: y - b.top,
    };
  };

  const beginPinch = () => {
    const [a, b] = [...pointers.values()];

    if (!a || !b) return;

    const center = local(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2
    );

    pinch = {
      distance: Math.max(
        1,
        Math.hypot(a.x - b.x, a.y - b.y)
      ),
      scale: camera.pixelsPerUnit,
      anchor: camera.worldPoint(center.x, center.y),
    };
  };

  element.tabIndex = 0;

  element.setAttribute(
    'aria-label',
    'Карта мира. Перемещение стрелками, масштаб плюс и минус.'
  );

  element.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;

    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.size === 1) {
      start = {
        x: event.clientX,
        y: event.clientY,
      };

      dragged = false;

      pendingDx = 0;
      pendingDy = 0;
    }

    if (pointers.size === 2) {
      pendingDx = 0;
      pendingDy = 0;

      beginPinch();
      dragged = true;
    }
  });

  element.addEventListener('pointermove', event => {
    const prior = pointers.get(event.pointerId);

    if (!prior) return;

    pendingDx += event.clientX - prior.x;
    pendingDy += event.clientY - prior.y;

    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    lastEvent = event;

    if (
      start &&
      Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y
      ) > 5
    ) {
      dragged = true;
    }

    if (!dragged) return;

    if (!element.hasPointerCapture(event.pointerId)) {
      element.setPointerCapture(event.pointerId);
    }

    if (ticking) return;

    ticking = true;

    window.requestAnimationFrame(() => {
      if (!lastEvent || !dragged) {
        ticking = false;
        return;
      }

      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()];

        if (a && b) {
          const center = local(
            (a.x + b.x) / 2,
            (a.y + b.y) / 2
          );

          camera.zoom(
            pinch.scale *
              Math.hypot(
                a.x - b.x,
                a.y - b.y
              ) /
              pinch.distance,
            center.x,
            center.y
          );

          camera.x =
            pinch.anchor.x -
            (center.x - camera.width / 2) /
              camera.pixelsPerUnit;

          camera.y =
            pinch.anchor.y -
            (center.y - camera.height / 2) /
              camera.pixelsPerUnit;
        }

        pendingDx = 0;
        pendingDy = 0;
      } else {
        const dx = pendingDx;
        const dy = pendingDy;

        pendingDx = 0;
        pendingDy = 0;

        camera.pan(dx, dy);
      }

      changed();

      ticking = false;
    });
  });

  for (
    const type of [
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ] as const
  ) {
    element.addEventListener(type, event => {
      pointers.delete(event.pointerId);

      pinch = undefined;
      lastEvent = undefined;

      pendingDx = 0;
      pendingDy = 0;

      if (pointers.size === 2) {
        beginPinch();
      }
    });
  }

  element.addEventListener(
    'click',
    event => {
      if (dragged) {
        event.preventDefault();
        event.stopPropagation();
        dragged = false;
      }
    },
    true
  );

  element.addEventListener(
    'wheel',
    event => {
      event.preventDefault();

      const p = local(
        event.clientX,
        event.clientY
      );

      camera.zoom(
        camera.pixelsPerUnit *
          Math.exp(
            -Math.max(
              -250,
              Math.min(250, event.deltaY)
            ) *
              0.002
          ),
        p.x,
        p.y
      );

      changed();
    },
    { passive: false }
  );

  element.addEventListener(
    'dblclick',
    event => {
      if (
        (event.target as Element).closest(
          'button'
        )
      ) {
        return;
      }

      event.preventDefault();

      const p = local(
        event.clientX,
        event.clientY
      );

      camera.zoom(
        camera.pixelsPerUnit * 2,
        p.x,
        p.y
      );

      changed();
    }
  );

  element.addEventListener(
    'keydown',
    event => {
      if (event.target !== element) return;

      const pan: Record<
        string,
        [number, number]
      > = {
        ArrowLeft: [80, 0],
        ArrowRight: [-80, 0],
        ArrowUp: [0, 80],
        ArrowDown: [0, -80],
      };

      if (pan[event.key]) {
        camera.pan(...pan[event.key]);
      } else if (
        event.key === '+' ||
        event.key === '='
      ) {
        camera.zoom(
          camera.pixelsPerUnit * 1.22
        );
      } else if (event.key === '-') {
        camera.zoom(
          camera.pixelsPerUnit / 1.22
        );
      } else {
        return;
      }

      event.preventDefault();
      changed();
    }
  );
}
