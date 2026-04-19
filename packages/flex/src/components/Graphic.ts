import { Graphics } from 'pixi.js';
import { LayoutBase } from '../core/LayoutBase';

export type DrawCallback = (g: Graphics, w: number, h: number) => void;

class GraphicLayout extends LayoutBase {
  private _graphics: Graphics;
  private _drawFn?: DrawCallback;

  constructor(props: any) {
    super(props);
    
    // Создаем PIXI.Graphics и добавляем в дисплей-лист
    this._graphics = new Graphics();
    this.addChild(this._graphics);

    if (props.draw) {
        this.draw = props.draw;
    }
  }

  // Сеттер для функции рисования
  set draw(fn: DrawCallback) {
    this._drawFn = fn;
    this.invalidate(); // Требуем перерисовки
  }

  // Переопределяем layout, чтобы вызывать рисование при изменении размеров
  layout(w: number, h: number) {
    super.layout(w, h);
    
    if (this._drawFn) {
        this._graphics.clear();
        // Передаем w и h, чтобы рисовать адаптивно
        this._drawFn(this._graphics, w, h);
    }
  }
}

export function Graphic(props: any) {
  return new GraphicLayout(props);
}
