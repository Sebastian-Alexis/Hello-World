<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let content: string = '';
  export let placeholder: string = 'Start writing your blog post...';
  export let readonly: boolean = false;
  
  let editorElement: HTMLElement;
  let editorInstance: any;
  const dispatch = createEventDispatcher();
  
  onMount(async () => {
    //dynamically import editor to avoid SSR issues
    const { default: EditorJS } = await import('@editorjs/editorjs');
    const Header = await import('@editorjs/header');
    const List = await import('@editorjs/list');
    const Code = await import('@editorjs/code');
    const InlineCode = await import('@editorjs/inline-code');
    const Table = await import('@editorjs/table');
    const Quote = await import('@editorjs/quote');
    const Marker = await import('@editorjs/marker');
    const Warning = await import('@editorjs/warning');
    const Delimiter = await import('@editorjs/delimiter');
    const RawTool = await import('@editorjs/raw');
    const Embed = await import('@editorjs/embed');
    const LinkTool = await import('@editorjs/link');
    const Image = await import('@editorjs/image');
    
    editorInstance = new EditorJS({
      holder: editorElement,
      data: content ? JSON.parse(content) : undefined,
      readOnly: readonly,
      placeholder,
      tools: {
        header: {
          class: Header.default,
          config: {
            placeholder: 'Enter a header',
            levels: [2, 3, 4],
            defaultLevel: 2
          }
        },
        list: {
          class: List.default,
          inlineToolbar: true,
          config: {
            defaultStyle: 'unordered'
          }
        },
        code: {
          class: Code.default,
          config: {
            placeholder: 'Enter code here...'
          }
        },
        inlineCode: {
          class: InlineCode.default,
          shortcut: 'CMD+SHIFT+M'
        },
        table: {
          class: Table.default,
          inlineToolbar: true,
          config: {
            rows: 2,
            cols: 3
          }
        },
        quote: {
          class: Quote.default,
          inlineToolbar: true,
          shortcut: 'CMD+SHIFT+O',
          config: {
            quotePlaceholder: 'Enter a quote',
            captionPlaceholder: 'Quote\'s author'
          }
        },
        marker: {
          class: Marker.default,
          shortcut: 'CMD+SHIFT+H'
        },
        warning: {
          class: Warning.default,
          inlineToolbar: true,
          shortcut: 'CMD+SHIFT+W',
          config: {
            titlePlaceholder: 'Title',
            messagePlaceholder: 'Message'
          }
        },
        delimiter: Delimiter.default,
        raw: RawTool.default,
        embed: {
          class: Embed.default,
          config: {
            services: {
              youtube: true,
              codesandbox: true,
              codepen: true,
              twitter: true,
              instagram: true
            }
          }
        },
        linkTool: {
          class: LinkTool.default,
          config: {
            endpoint: '/api/admin/link-preview',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          }
        },
        image: {
          class: Image.default,
          config: {
            endpoints: {
              byFile: '/api/admin/upload/image',
              byUrl: '/api/admin/upload/image-url'
            },
            additionalRequestHeaders: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          }
        }
      },
      onChange: async () => {
        if (!readonly) {
          const outputData = await editorInstance.save();
          dispatch('change', {
            content: JSON.stringify(outputData),
            blocks: outputData.blocks
          });
        }
      },
      onReady: () => {
        dispatch('ready');
      }
    });
    
    return () => {
      if (editorInstance && editorInstance.destroy) {
        editorInstance.destroy();
      }
    };
  });
  
  export async function save() {
    if (editorInstance) {
      return await editorInstance.save();
    }
    return null;
  }
  
  export async function clear() {
    if (editorInstance) {
      await editorInstance.clear();
    }
  }
</script>

<div class="editor-container">
  <div bind:this={editorElement} class="editor-js"></div>
</div>

<style>
  .editor-container {
    @apply border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800;
  }
  
  :global(.codex-editor) {
    @apply p-4;
  }
  
  :global(.codex-editor__redactor) {
    @apply min-h-96;
  }
  
  :global(.ce-block__content) {
    @apply max-w-none;
  }
  
  :global(.ce-toolbar__content) {
    @apply max-w-none;
  }
  
  :global(.ce-paragraph[data-placeholder]:empty::before) {
    @apply text-gray-400 dark:text-gray-500;
  }
</style>