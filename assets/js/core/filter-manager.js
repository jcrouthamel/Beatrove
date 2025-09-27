/**
 * Beatrove - Filter Manager Module
 * Centralized management of all filter states and interactions
 */

'use strict';

export class FilterManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.filterStates = {
      azFilter: null,
      originalPagination: null
    };
  }

  /**
   * Set A-Z filter and handle pagination
   * @param {string} letter - The letter/category to filter by
   */
  setAZFilter(letter) {
    // Store original pagination settings if not already stored
    if (!this.filterStates.originalPagination) {
      this.filterStates.originalPagination = {
        tracksPerPage: this.renderer.tracksPerPage,
        currentPage: this.renderer.currentPage
      };
    }

    this.filterStates.azFilter = letter;
    this.renderer.azBarActive = letter;
    this.renderer.setTracksPerPage('all');
    this.renderer.currentPage = 1;
    this.updateAZBarVisualState();
    this.renderer.render();
  }

  /**
   * Clear A-Z filter with full restoration (for explicit user action like ALL button)
   */
  clearAZFilter() {
    this.filterStates.azFilter = null;
    this.renderer.azBarActive = null;

    // Restore original pagination if stored
    if (this.filterStates.originalPagination) {
      this.renderer.setTracksPerPage(this.filterStates.originalPagination.tracksPerPage);
      this.renderer.currentPage = this.filterStates.originalPagination.currentPage;
      this.filterStates.originalPagination = null;
    }

    this.updateAZBarVisualState();
    this.renderer.render();
  }

  /**
   * Clear A-Z filter when other filters are used (preserves current pagination)
   */
  clearAZFilterOnOtherFilterUse() {
    if (this.filterStates.azFilter) {
      this.filterStates.azFilter = null;
      this.renderer.azBarActive = null;
      this.filterStates.originalPagination = null; // Clear stored settings but don't restore
      this.updateAZBarVisualState();
      // Don't call render() - let the calling filter handle it
    }
  }

  /**
   * Update visual state of A-Z bar buttons
   */
  updateAZBarVisualState() {
    // Use cached elements if available, otherwise fall back to DOM queries
    if (this.renderer.azBarCache.elementsMap.size > 0) {
      // Remove active class from all cached elements
      for (const btn of this.renderer.azBarCache.elementsMap.values()) {
        btn.classList.remove('active');
      }

      // Set active state based on current filter
      if (this.filterStates.azFilter) {
        const activeBtn = this.renderer.azBarCache.elementsMap.get(this.filterStates.azFilter);
        if (activeBtn) {
          activeBtn.classList.add('active');
        }
      } else {
        // Set ALL button as active when no filter is applied
        const allBtn = this.renderer.azBarCache.elementsMap.get('all');
        if (allBtn) {
          allBtn.classList.add('active');
        }
      }
    } else {
      // Fallback to DOM queries if cache not available
      document.querySelectorAll('.az-letter').forEach(btn => btn.classList.remove('active'));

      if (this.filterStates.azFilter) {
        const activeBtn = document.querySelector(`[data-letter="${this.filterStates.azFilter}"]`);
        if (activeBtn) {
          activeBtn.classList.add('active');
        }
      } else {
        const allBtn = document.querySelector('[data-letter="all"]');
        if (allBtn) {
          allBtn.classList.add('active');
        }
      }
    }
  }

  /**
   * Handle pagination changes while A-Z filter is active
   * @param {number|string} tracksPerPage - New tracks per page value
   */
  updatePaginationDuringAZFilter(tracksPerPage) {
    if (this.filterStates.azFilter && this.filterStates.originalPagination && tracksPerPage !== 'all') {
      this.filterStates.originalPagination.tracksPerPage = parseInt(tracksPerPage);
    }
  }

  /**
   * Get current A-Z filter state for use in other filters
   */
  getAZFilterState() {
    return this.filterStates.azFilter || '';
  }

  /**
   * Check if A-Z filter is currently active
   */
  isAZFilterActive() {
    return !!this.filterStates.azFilter;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.filterStates = {
      azFilter: null,
      originalPagination: null
    };
  }
}