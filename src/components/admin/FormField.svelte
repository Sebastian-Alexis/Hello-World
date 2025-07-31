<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let type: string = 'text';
  export let name: string;
  export let label: string;
  export let value: any = '';
  export let placeholder: string = '';
  export let required: boolean = false;
  export let disabled: boolean = false;
  export let readonly: boolean = false;
  export let help: string = '';
  export let error: string = '';
  export let options: Array<{value: any, label: string}> = [];
  export let rows: number = 3;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let step: number | undefined = undefined;
  export let maxlength: number | undefined = undefined;
  export let pattern: string | undefined = undefined;
  export let validation: Array<{rule: string, message: string}> = [];
  
  const dispatch = createEventDispatcher();
  
  let fieldError = '';
  let isValid = true;
  
  //reactive validation
  $: {
    if (value && validation.length > 0) {
      validateField();
    }
  }
  
  function validateField() {
    fieldError = '';
    isValid = true;
    
    for (const rule of validation) {
      const isRuleValid = checkValidationRule(rule.rule, value);
      if (!isRuleValid) {
        fieldError = rule.message;
        isValid = false;
        break;
      }
    }
    
    //dispatch validation result
    dispatch('validate', {
      name,
      value,
      isValid,
      error: fieldError
    });
  }
  
  function checkValidationRule(rule: string, val: any): boolean {
    switch (rule) {
      case 'required':
        return val !== null && val !== undefined && val !== '';
      
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !val || emailRegex.test(val);
      
      case 'url':
        try {
          new URL(val);
          return true;
        } catch {
          return !val || false;
        }
      
      case 'phone':
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return !val || phoneRegex.test(val.replace(/[\s\-\(\)]/g, ''));
      
      case 'min_length':
        const minLen = parseInt(rule.split(':')[1]);
        return !val || val.length >= minLen;
      
      case 'max_length':
        const maxLen = parseInt(rule.split(':')[1]);
        return !val || val.length <= maxLen;
      
      case 'numeric':
        return !val || !isNaN(val);
      
      case 'alpha':
        const alphaRegex = /^[a-zA-Z]+$/;
        return !val || alphaRegex.test(val);
      
      case 'alphanumeric':
        const alphaNumRegex = /^[a-zA-Z0-9]+$/;
        return !val || alphaNumRegex.test(val);
      
      case 'slug':
        const slugRegex = /^[a-z0-9-]+$/;
        return !val || slugRegex.test(val);
      
      default:
        return true;
    }
  }
  
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    value = type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    
    dispatch('input', { name, value, event });
    
    if (validation.length > 0) {
      validateField();
    }
  }
  
  function handleBlur(event: Event) {
    dispatch('blur', { name, value, event });
    
    if (validation.length > 0) {
      validateField();
    }
  }
  
  //use provided error or field validation error
  $: displayError = error || fieldError;
  $: hasError = !!displayError;
</script>

<div class="form-field">
  {#if type !== 'checkbox'}
    <label for={name} class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      {label}
      {#if required}
        <span class="text-red-500">*</span>
      {/if}
    </label>
  {/if}
  
  {#if type === 'textarea'}
    <textarea
      {name}
      id={name}
      bind:value
      {placeholder}
      {required}
      {disabled}
      {readonly}
      {rows}
      {maxlength}
      class="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm {hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}"
      on:input={handleInput}
      on:blur={handleBlur}
    ></textarea>
  {:else if type === 'select'}
    <select
      {name}
      id={name}
      bind:value
      {required}
      {disabled}
      class="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm {hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}"
      on:change={handleInput}
      on:blur={handleBlur}
    >
      {#if placeholder}
        <option value="">{placeholder}</option>
      {/if}
      {#each options as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  {:else if type === 'checkbox'}
    <div class="flex items-center">
      <input
        type="checkbox"
        {name}
        id={name}
        bind:checked={value}
        {required}
        {disabled}
        class="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 {hasError ? 'border-red-300 focus:ring-red-500' : ''}"
        on:change={handleInput}
        on:blur={handleBlur}
      >
      <label for={name} class="ml-2 block text-sm text-gray-700 dark:text-gray-300">
        {label}
        {#if required}
          <span class="text-red-500">*</span>
        {/if}
      </label>
    </div>
  {:else if type === 'file'}
    <input
      type="file"
      {name}
      id={name}
      {required}
      {disabled}
      class="block w-full text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none {hasError ? 'border-red-300' : ''}"
      on:change={handleInput}
      on:blur={handleBlur}
    >
  {:else}
    <input
      {type}
      {name}
      id={name}
      bind:value
      {placeholder}
      {required}
      {disabled}
      {readonly}
      {min}
      {max}
      {step}
      {maxlength}
      {pattern}
      class="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm {hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}"
      on:input={handleInput}
      on:blur={handleBlur}
    >
  {/if}
  
  {#if help && !hasError}
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{help}</p>
  {/if}
  
  {#if hasError}
    <p class="mt-1 text-xs text-red-600 dark:text-red-400">{displayError}</p>
  {/if}
</div>

<style>
  .form-field {
    @apply mb-6;
  }
</style>