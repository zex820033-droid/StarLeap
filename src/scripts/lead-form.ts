const form = document.querySelector<HTMLFormElement>('#lead-form');
const email = document.querySelector<HTMLInputElement>('#email');
const error = document.querySelector<HTMLElement>('#email-error');
const success = document.querySelector<HTMLElement>('#lead-success');
const reset = document.querySelector<HTMLButtonElement>('#lead-reset');
const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');

if (form && email && error && success && reset && submit) {
  // Enable only after the submit handler is attached, preventing accidental
  // browser navigation with form fields in the URL when JavaScript is disabled.
  let attempted = false;
  const validate = () => {
    const overLimit = email.value.length > 254;
    const valid = email.validity.valid && !overLimit;
    error.textContent = valid ? '' : (overLimit ? email.dataset.lengthMessage! : email.dataset.invalidMessage!);
    email.setAttribute('aria-invalid', String(!valid));
    return valid;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    attempted = true;
    email.value = email.value.trim();
    if (!validate()) {
      email.focus();
      return;
    }

    // TODO(Stage 2): connect an explicitly authorized submission backend,
    // handle network errors and await a confirmed receipt before showing success.
    // Stage 1 intentionally makes NO request and stores NO form information.
    // This is a clearly labelled, browser-only demonstration of the success state.
    // Reserve the form's measured height so confirmation never moves the footer.
    success.style.minBlockSize = `${form.getBoundingClientRect().height}px`;
    form.hidden = true;
    success.hidden = false;
    form.reset();
    success.focus();
  });
  email.addEventListener('input', () => { if (attempted) validate(); });
  reset.addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    attempted = false;
    error.textContent = '';
    email.removeAttribute('aria-invalid');
    email.focus();
  });
  submit.disabled = false;
}
