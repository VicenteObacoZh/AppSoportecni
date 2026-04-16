(function () {
  const dashboardShell = document.querySelector('.app-dashboard');
  const toggleButtons = Array.from(document.querySelectorAll('[data-nav-toggle]'));
  const navLinks = Array.from(document.querySelectorAll('.app-nav__item'));

  if (!dashboardShell || toggleButtons.length === 0) {
    return;
  }

  function setExpandedState(isOpen) {
    dashboardShell.classList.toggle('app-dashboard--nav-open', isOpen);
    toggleButtons.forEach((button) => {
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const isOpen = dashboardShell.classList.contains('app-dashboard--nav-open');
      setExpandedState(!isOpen);
    });
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 720) {
        setExpandedState(false);
      }
    });
  });
})();
