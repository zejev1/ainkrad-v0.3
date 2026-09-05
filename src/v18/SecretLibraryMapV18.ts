/**
 * Ainkrad v18 — Secret Library map UI.
 *
 * Отдельное физическое отображение Тайной библиотеки.
 *
 * - стоит снизу слева на карте;
 * - не вмешивается в обычные места Ainkrad;
 * - кликабельна;
 * - показывает живую телеметрию библиотеки;
 * - получает данные через BroadcastChannel от runtime/worker.
 */

import type {
  SecretLibraryInspectorV18,
} from './SecretLibraryPlaceV18';

const CHANNEL_NAME =
  'ainkrad-secret-library-v18';

const BUILDING_ID =
  'secret-library-map-building-v18';

const PANEL_ID =
  'secret-library-panel-v18';

let latestInspector:
  SecretLibraryInspectorV18 | undefined;

let building:
  HTMLButtonElement | undefined;

let panel:
  HTMLDivElement | undefined;

function escapeHtml(
  value: unknown,
): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function injectStyles(): void {
  if (
    document.getElementById(
      'secret-library-styles-v18',
    )
  ) {
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    'secret-library-styles-v18';

  style.textContent = `
    #${BUILDING_ID} {
      position: absolute;
      left: 5.5%;
      top: 84%;
      z-index: 24;

      width: 78px;
      min-height: 82px;

      border: 1px solid rgba(214, 190, 110, 0.75);
      border-radius: 14px;

      padding: 7px 5px;

      background:
        linear-gradient(
          180deg,
          rgba(23, 17, 31, 0.96),
          rgba(7, 10, 16, 0.97)
        );

      box-shadow:
        0 0 18px rgba(177, 137, 255, 0.28),
        inset 0 0 12px rgba(210, 185, 110, 0.08);

      color: #f4e8c5;

      cursor: pointer;

      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      gap: 3px;

      transform: translate(-50%, -50%);

      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    #${BUILDING_ID}:active {
      transform:
        translate(-50%, -50%)
        scale(0.96);
    }

    #${BUILDING_ID}
    .secret-library-building-icon {
      font-size: 31px;
      line-height: 1;
      filter:
        drop-shadow(
          0 0 7px
          rgba(202, 173, 255, 0.7)
        );
    }

    #${BUILDING_ID}
    .secret-library-building-name {
      font-size: 9px;
      line-height: 1.15;
      text-align: center;
      font-weight: 700;
    }

    #${BUILDING_ID}
    .secret-library-building-status {
      font-size: 8px;
      opacity: 0.82;
      text-align: center;
    }

    #${BUILDING_ID}.is-open {
      border-color:
        rgba(146, 255, 180, 0.9);

      box-shadow:
        0 0 22px
          rgba(71, 255, 134, 0.36),
        inset 0 0 15px
          rgba(71, 255, 134, 0.08);
    }

    #${PANEL_ID} {
      position: fixed;
      inset: 0;

      z-index: 99999;

      background:
        rgba(4, 6, 11, 0.74);

      backdrop-filter:
        blur(4px);

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 12px;
    }

    #${PANEL_ID}[hidden] {
      display: none !important;
    }

    #${PANEL_ID}
    .secret-library-window {
      width:
        min(760px, 100%);

      max-height:
        90vh;

      overflow: auto;

      border:
        1px solid
        rgba(210, 185, 110, 0.55);

      border-radius: 18px;

      background:
        linear-gradient(
          180deg,
          #17131f,
          #090c12
        );

      color: #ece7da;

      box-shadow:
        0 22px 80px
        rgba(0, 0, 0, 0.65);

      padding: 16px;
    }

    .secret-library-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;

      padding-bottom: 12px;

      border-bottom:
        1px solid
        rgba(255, 255, 255, 0.09);
    }

    .secret-library-header h2 {
      margin: 0;
      font-size: 21px;
    }

    .secret-library-header p {
      margin:
        5px 0 0;

      opacity: 0.76;
      font-size: 12px;
    }

    .secret-library-close {
      border: 0;
      border-radius: 10px;

      width: 38px;
      height: 38px;

      background:
        rgba(255,255,255,0.08);

      color: white;

      font-size: 22px;
    }

    .secret-library-summary {
      display: grid;

      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );

      gap: 8px;

      margin-top: 12px;
    }

    .secret-library-stat {
      padding: 10px;

      border-radius: 12px;

      background:
        rgba(255,255,255,0.055);
    }

    .secret-library-stat span {
      display: block;

      font-size: 10px;
      opacity: 0.7;
    }

    .secret-library-stat strong {
      display: block;

      margin-top: 3px;

      font-size: 15px;
    }

    .secret-library-section {
      margin-top: 17px;
    }

    .secret-library-section h3 {
      margin:
        0 0 8px;

      font-size: 15px;
    }

    .secret-library-visitor {
      margin-bottom: 10px;

      padding: 11px;

      border-radius: 12px;

      background:
        rgba(255,255,255,0.045);

      border:
        1px solid
        rgba(255,255,255,0.06);
    }

    .secret-library-visitor-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;

      font-size: 13px;
    }

    .secret-library-visitor-meta {
      margin-top: 6px;

      font-size: 11px;
      opacity: 0.76;
    }

    .secret-library-knowledge {
      margin-top: 9px;

      padding:
        9px 10px;

      border-left:
        3px solid
        rgba(207, 178, 255, 0.75);

      background:
        rgba(150, 100, 220, 0.08);

      border-radius:
        0 9px 9px 0;
    }

    .secret-library-knowledge strong {
      font-size: 12px;
    }

    .secret-library-knowledge p {
      margin:
        5px 0;

      font-size: 11px;
      line-height: 1.35;
    }

    .secret-library-source {
      font-size: 10px;
      opacity: 0.72;
      word-break: break-all;
    }

    .secret-library-rules {
      padding-left: 18px;
      margin-bottom: 0;
    }

    .secret-library-rules li {
      margin-bottom: 5px;

      font-size: 11px;
      opacity: 0.83;
    }

    .secret-library-waiting {
      padding: 24px 10px;

      text-align: center;

      opacity: 0.75;

      font-size: 13px;
    }

    @media (max-width: 600px) {
      #${BUILDING_ID} {
        width: 66px;
        min-height: 72px;
      }

      #${BUILDING_ID}
      .secret-library-building-icon {
        font-size: 27px;
      }

      .secret-library-summary {
        grid-template-columns:
          1fr 1fr;
      }

      #${PANEL_ID}
      .secret-library-window {
        padding: 13px;
      }
    }
  `;

  document.head.append(style);
}

function statusText(): string {
  if (!latestInspector) {
    return 'ожидает мир';
  }

  return latestInspector.status;
}

function updateBuilding(): void {
  if (!building) {
    return;
  }

  building.classList.toggle(
    'is-open',
    latestInspector?.status ===
      'Открыта',
  );

  const status =
    building.querySelector(
      '.secret-library-building-status',
    );

  if (status) {
    status.textContent =
      statusText();
  }
}

function createBuilding(): void {
  if (
    document.getElementById(
      BUILDING_ID,
    )
  ) {
    return;
  }

  const placesLayer =
    document.getElementById(
      'places-layer',
    );

  if (!placesLayer) {
    return;
  }

  const element =
    document.createElement(
      'button',
    );

  element.id =
    BUILDING_ID;

  element.type =
    'button';

  element.setAttribute(
    'aria-label',
    'Открыть Тайную библиотеку',
  );

  element.innerHTML = `
    <span
      class="secret-library-building-icon"
      aria-hidden="true"
    >
      🏛️
    </span>

    <span
      class="secret-library-building-name"
    >
      Тайная<br>библиотека
    </span>

    <span
      class="secret-library-building-status"
    >
      ожидает мир
    </span>
  `;

  element.addEventListener(
    'click',
    () => {
      openPanel();
    },
  );

  placesLayer.append(
    element,
  );

  building =
    element;

  updateBuilding();
}

function visitorHtml(
  inspector:
    SecretLibraryInspectorV18,
): string {
  if (
    inspector.selectedVisitors
      .length === 0
  ) {
    return `
      <div
        class="secret-library-waiting"
      >
        В этом году посетители
        пока не выбраны.
      </div>
    `;
  }

  return inspector
    .selectedVisitors
    .map(
      (visitor) => {
        const knowledgeHtml =
          visitor.learnedKnowledge
            .length === 0
            ? `
              <div
                class="secret-library-visitor-meta"
              >
                Усвоенных знаний пока нет.
              </div>
            `
            : visitor
                .learnedKnowledge
                .map(
                  (
                    knowledge,
                  ) => `
                    <div
                      class="secret-library-knowledge"
                    >
                      <strong>
                        ${escapeHtml(
                          knowledge.topic,
                        )}
                      </strong>

                      <p>
                        Источник:
                        <b>
                          ${escapeHtml(
                            knowledge.sourceTitle,
                          )}
                        </b>
                      </p>

                      <p>
                        Понимание:
                        ${escapeHtml(
                          knowledge.understandingPercent,
                        )}%
                      </p>

                      ${
                        knowledge.rememberedText
                          ? `
                            <p>
                              ${escapeHtml(
                                knowledge.rememberedText,
                              )}
                            </p>
                          `
                          : ''
                      }

                      <div
                        class="secret-library-source"
                      >
                        ${escapeHtml(
                          knowledge.sourceUrl,
                        )}
                      </div>
                    </div>
                  `,
                )
                .join('');

        return `
          <div
            class="secret-library-visitor"
          >
            <div
              class="secret-library-visitor-head"
            >
              <strong>
                ${escapeHtml(
                  visitor.agentName,
                )}
              </strong>

              <span>
                ${escapeHtml(
                  visitor.status,
                )}
              </span>
            </div>

            <div
              class="secret-library-visitor-meta"
            >
              Учился:
              ${escapeHtml(
                visitor.studyHours,
              )} ч ·
              Усвоено:
              ${escapeHtml(
                visitor.learnedCount,
              )}
            </div>

            ${knowledgeHtml}
          </div>
        `;
      },
    )
    .join('');
}

function panelContent(): string {
  const inspector =
    latestInspector;

  if (!inspector) {
    return `
      <div
        class="secret-library-header"
      >
        <div>
          <h2>
            🏛️ Тайная библиотека
          </h2>

          <p>
            Реальные знания человечества
          </p>
        </div>

        <button
          type="button"
          class="secret-library-close"
        >
          ×
        </button>
      </div>

      <div
        class="secret-library-waiting"
      >
        Жду первые данные
        от мира Ainkrad…
      </div>
    `;
  }

  return `
    <div
      class="secret-library-header"
    >
      <div>
        <h2>
          🏛️ ${escapeHtml(
            inspector.name,
          )}
        </h2>

        <p>
          Реальные человеческие
          источники · Wikisource
        </p>
      </div>

      <button
        type="button"
        class="secret-library-close"
      >
        ×
      </button>
    </div>

    <div
      class="secret-library-summary"
    >
      <div
        class="secret-library-stat"
      >
        <span>
          Статус
        </span>

        <strong>
          ${escapeHtml(
            inspector.status,
          )}
        </strong>
      </div>

      <div
        class="secret-library-stat"
      >
        <span>
          Игровой год
        </span>

        <strong>
          ${escapeHtml(
            inspector.currentYear,
          )}
        </strong>
      </div>

      <div
        class="secret-library-stat"
      >
        <span>
          Посетители
        </span>

        <strong>
          ${escapeHtml(
            inspector
              .selectedVisitors
              .length,
          )}
          /
          ${escapeHtml(
            inspector.visitorLimit,
          )}
        </strong>
      </div>

      <div
        class="secret-library-stat"
      >
        <span>
          Всего обучения
        </span>

        <strong>
          ${escapeHtml(
            inspector
              .totalStudyHours,
          )}
          ч
        </strong>
      </div>

      <div
        class="secret-library-stat"
      >
        <span>
          Усвоено знаний
        </span>

        <strong>
          ${escapeHtml(
            inspector
              .totalLearnedKnowledge,
          )}
        </strong>
      </div>

      <div
        class="secret-library-stat"
      >
        <span>
          Внешний источник
        </span>

        <strong>
          ${escapeHtml(
            inspector
              .externalAccess
              .source,
          )}
        </strong>
      </div>
    </div>

    <section
      class="secret-library-section"
    >
      <h3>
        Посетители этого года
      </h3>

      ${visitorHtml(
        inspector,
      )}
    </section>

    <section
      class="secret-library-section"
    >
      <h3>
        Правила библиотеки
      </h3>

      <ul
        class="secret-library-rules"
      >
        ${inspector.rules
          .map(
            (rule) => `
              <li>
                ${escapeHtml(
                  rule,
                )}
              </li>
            `,
          )
          .join('')}
      </ul>
    </section>
  `;
}

function createPanel(): void {
  if (
    document.getElementById(
      PANEL_ID,
    )
  ) {
    return;
  }

  const element =
    document.createElement(
      'div',
    );

  element.id =
    PANEL_ID;

  element.hidden =
    true;

  element.innerHTML = `
    <div
      class="secret-library-window"
    ></div>
  `;

  element.addEventListener(
    'click',
    (
      event,
    ) => {
      if (
        event.target ===
        element
      ) {
        closePanel();
      }
    },
  );

  document.body.append(
    element,
  );

  panel =
    element;
}

function openPanel(): void {
  createPanel();

  if (!panel) {
    return;
  }

  const windowElement =
    panel.querySelector(
      '.secret-library-window',
    );

  if (!windowElement) {
    return;
  }

  windowElement.innerHTML =
    panelContent();

  const close =
    windowElement.querySelector<
      HTMLButtonElement
    >(
      '.secret-library-close',
    );

  close?.addEventListener(
    'click',
    closePanel,
  );

  panel.hidden =
    false;
}

function closePanel(): void {
  if (panel) {
    panel.hidden =
      true;
  }
}

function refreshOpenPanel(): void {
  if (
    !panel ||
    panel.hidden
  ) {
    return;
  }

  openPanel();
}

function connectTelemetry(): void {
  if (
    typeof BroadcastChannel ===
    'undefined'
  ) {
    return;
  }

  const channel =
    new BroadcastChannel(
      CHANNEL_NAME,
    );

  channel.addEventListener(
    'message',
    (
      event:
        MessageEvent<
          SecretLibraryInspectorV18
        >,
    ) => {
      const data =
        event.data;

      if (
        !data ||
        data.placeId !==
          'secret_library_v18'
      ) {
        return;
      }

      latestInspector =
        data;

      updateBuilding();
      refreshOpenPanel();
    },
  );
}

function boot(): void {
  injectStyles();
  createPanel();
  createBuilding();

  /**
   * browser.ts сначала строит DOM карты.
   * Если мы запустились чуть раньше —
   * ждём появления places-layer.
   */
  if (!building) {
    const observer =
      new MutationObserver(
        () => {
          createBuilding();

          if (building) {
            observer.disconnect();
          }
        },
      );

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
      },
    );
  }

  connectTelemetry();
}

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    boot,
    {
      once: true,
    },
  );
} else {
  boot();
}
