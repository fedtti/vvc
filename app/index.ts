import { WidgetInstance } from '@vivocha/public-entities';
import { WidgetInstanceWrapper, WidgetInstanceCreateOptions } from '@vivocha/public-entities/dist/wrappers/widget';
import { innerScript } from '@vivocha/public-entities/dist/wrappers/widget_inner';
import { DebuggerWidgetInstance } from '@vivocha/public-entities/dist/wrappers/widget_debugger';

window['vivocha'] = {
  getWidget(id: string) {
    return {
      close: () => {
        console.log('Widget request close to Vivocha');
      },
      engage: (media: string) => {
        console.log('Widget request engagement to Vivocha for media', media);
      }
    }
  }
};

fetch('/widget').then(response => response.json()).then((options: WidgetInstanceCreateOptions) => {
  WidgetInstanceWrapper.create(DebuggerWidgetInstance, options).then((widget: WidgetInstance) => {
    console.log(widget.css);
    console.log(widget.html);
    const style = document.createElement('style');
    style.innerText = widget.css;
    document.head.appendChild(style);
    const div = document.createElement('div');
    div.innerHTML = widget.html;
    innerScript(div);
    document.body.appendChild(div);
  }, err => {
    console.error(err);
  });
});
