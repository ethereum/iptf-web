// Generate Table of Contents from article headings
(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', generateToC);
  } else {
    generateToC();
  }

  function generateToC() {
    const content = document.querySelector('.post-content');
    const tocList = document.getElementById('toc-list');
    const tocContainer = document.querySelector('.post-toc');

    if (!content || !tocList || !tocContainer) return;

    // Get all h2 and h3 headings
    const headings = content.querySelectorAll('h2, h3');

    if (headings.length === 0) {
      // Hide ToC if no headings
      tocContainer.style.display = 'none';
      return;
    }

    // Build ToC
    let currentList = tocList;
    let lastLevel = 2;

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      const text = heading.textContent;
      const id = heading.id || `heading-${index}`;

      // Ensure heading has an ID
      if (!heading.id) {
        heading.id = id;
      }

      // Create list item
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${id}`;
      a.textContent = text;
      li.appendChild(a);

      // Handle nesting for h3 (sub-items)
      if (level > lastLevel) {
        const subList = document.createElement('ul');
        const lastLi = currentList.lastElementChild;
        if (lastLi) {
          lastLi.appendChild(subList);
          currentList = subList;
        }
      } else if (level < lastLevel) {
        // Go back up to parent list
        const parent = currentList.parentElement?.parentElement;
        if (parent && parent.tagName === 'UL') {
          currentList = parent;
        }
      }

      currentList.appendChild(li);
      lastLevel = level;
    });

    // Add click handlers for smooth scrolling
    tocList.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Update URL without triggering scroll
          history.pushState(null, '', this.getAttribute('href'));
        }
      });
    });

    // Highlight current section on scroll
    if (window.IntersectionObserver) {
      const observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            const link = tocList.querySelector(`a[href="#${id}"]`);
            if (link) {
              if (entry.isIntersecting) {
                // Remove active from all
                tocList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                // Add active to current
                link.classList.add('active');
              }
            }
          });
        },
        { rootMargin: '-100px 0px -80% 0px' }
      );

      headings.forEach(heading => observer.observe(heading));
    }

    // Show ToC after scrolling down
    let scrollTimeout;
    const showToC = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      // Show ToC after scrolling 300px down
      if (scrollY > 300) {
        tocContainer.classList.add('visible');
      } else {
        tocContainer.classList.remove('visible');
      }
    };

    // Check on scroll with debounce
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(showToC, 50);
    });

    // Initial check
    showToC();
  }
})();
