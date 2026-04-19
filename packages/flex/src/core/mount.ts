import { LayoutBase } from './LayoutBase';
import { abstractWindow } from './env';

/**
 * Монтирует корневой компонент на сцену Pixi.
 * Настраивает автоматический ресайз.
 */
export function mount(rootFactory: () => any, container: any) {
  // 1. Создаем корневой элемент
  const root = rootFactory();
  
  // 2. Добавляем на сцену
  container.addChild(root);

  // 3. Авто-ресайз
  if (root instanceof LayoutBase) {
    // Initial Layout Pass
    root.resize(abstractWindow.width, abstractWindow.height);
    
    // Resize Listener
    abstractWindow.onResize((w, h) => {
      root.resize(w, h);
    });
  }

  return { root };
}