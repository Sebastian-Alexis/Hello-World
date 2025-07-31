<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let accept: string = 'image/*';
  export let multiple: boolean = true;
  export let maxSize: number = 10 * 1024 * 1024; // 10MB
  export let disabled: boolean = false;
  
  let isDragOver = false;
  let uploading = false;
  let uploadProgress = 0;
  let files: FileList | null = null;
  let fileInput: HTMLInputElement;
  
  const dispatch = createEventDispatcher();
  
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!disabled) {
      isDragOver = true;
    }
  }
  
  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }
  
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    
    if (disabled || !event.dataTransfer) return;
    
    const droppedFiles = event.dataTransfer.files;
    handleFiles(droppedFiles);
  }
  
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      handleFiles(target.files);
    }
  }
  
  function handleFiles(fileList: FileList) {
    const validFiles = Array.from(fileList).filter(file => {
      if (file.size > maxSize) {
        dispatch('error', {
          message: `File "${file.name}" is too large. Maximum size is ${formatFileSize(maxSize)}.`,
          file
        });
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  }
  
  async function uploadFiles(filesToUpload: File[]) {
    uploading = true;
    uploadProgress = 0;
    
    try {
      const formData = new FormData();
      filesToUpload.forEach(file => {
        formData.append('files', file);
      });
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          uploadProgress = Math.round((event.loaded / event.total) * 100);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          dispatch('success', {
            files: response.files,
            message: `Successfully uploaded ${response.files.length} file(s)`
          });
        } else {
          dispatch('error', {
            message: 'Upload failed. Please try again.',
            status: xhr.status
          });
        }
        uploading = false;
        uploadProgress = 0;
        
        //reset file input
        if (fileInput) {
          fileInput.value = '';
        }
      });
      
      xhr.addEventListener('error', () => {
        dispatch('error', {
          message: 'Upload failed. Please check your connection and try again.'
        });
        uploading = false;
        uploadProgress = 0;
      });
      
      xhr.open('POST', '/api/admin/media/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('access_token')}`);
      xhr.send(formData);
      
    } catch (error) {
      console.error('Upload error:', error);
      dispatch('error', {
        message: 'Upload failed. Please try again.',
        error
      });
      uploading = false;
      uploadProgress = 0;
    }
  }
  
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function triggerFileSelect() {
    if (!disabled && fileInput) {
      fileInput.click();
    }
  }
</script>

<div class="media-upload">
  <input
    bind:this={fileInput}
    type="file"
    {accept}
    {multiple}
    {disabled}
    on:change={handleFileSelect}
    class="hidden"
  >
  
  <div
    class="upload-area"
    class:drag-over={isDragOver}
    class:uploading
    class:disabled
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
    on:click={triggerFileSelect}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && triggerFileSelect()}
  >
    {#if uploading}
      <div class="upload-progress">
        <svg class="w-12 h-12 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {uploadProgress}%"></div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Uploading... {uploadProgress}%
        </p>
      </div>
    {:else}
      <div class="upload-content">
        <svg class="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
          Upload files
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Drag and drop files here, or click to select files
        </p>
        <p class="text-xs text-gray-400 dark:text-gray-500">
          {accept === 'image/*' ? 'Images only' : accept} • Max {formatFileSize(maxSize)}
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .upload-area {
    @apply border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800;
  }
  
  .upload-area.drag-over {
    @apply border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-25;
  }
  
  .upload-area.uploading {
    @apply border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-25 cursor-not-allowed;
  }
  
  .upload-area.disabled {
    @apply border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50;
  }
  
  .upload-progress {
    @apply flex flex-col items-center;
  }
  
  .progress-bar {
    @apply w-full max-w-xs h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-4;
  }
  
  .progress-fill {
    @apply h-full bg-blue-600 rounded-full transition-all duration-300 ease-out;
  }
  
  .upload-content {
    @apply flex flex-col items-center;
  }
</style>