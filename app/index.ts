import { WidgetInstance } from '@vivocha/public-entities';
import { WidgetInstanceWrapper, WidgetInstanceCreateOptions } from '@vivocha/public-entities/dist/wrappers/widget';
import { DebuggerWidgetInstance } from '@vivocha/public-entities/dist/wrappers/widget_debugger';

fetch('/widget').then(response => response.json()).then((options: WidgetInstanceCreateOptions) => {
  WidgetInstanceWrapper.create(DebuggerWidgetInstance, options).then((widget: WidgetInstance) => {
    console.log(widget.css);
    console.log(widget.html);
    const style = document.createElement('style');
    style.innerText = widget.css;
    document.head.appendChild(style);
    const div = document.createElement('div');
    div.innerHTML = widget.html;
    document.body.appendChild(div);
  }, err => {
    console.error(err);
  });
});
