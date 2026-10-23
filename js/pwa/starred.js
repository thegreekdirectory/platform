// js/pwa/starred.js - COMPLETE FIX
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. For more information, visit https://thegreekdirectory.org/legal.

/* ============================================
   STARRED LISTINGS MANAGER - COMPLETE
   Handles all starring functionality across the app
   ============================================ */

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.StarredManager = {
    async toggleStar(listingId, listingData) {
        const normalizedId = String(listingId);
        try {
            await window.PWAStorage.init();
            const isStarred = await window.PWAStorage.isStarred(normalizedId);
            
            if (isStarred) {
                // Unstar — use removeStarred (matches storage.js method name)
                await window.PWAStorage.removeStarred(normalizedId);
                this.updateStarButtons(normalizedId, false);
                this.showToast('Removed from starred');
            } else {
                // Star — use addStarred (matches storage.js method name)
                if (!listingData) {
                    this.showToast('Unable to star this listing right now');
                    return false;
                }
                listingData.id = normalizedId;
                await window.PWAStorage.addStarred(listingData);
                this.updateStarButtons(normalizedId, true);
                this.showToast('Added to starred');
            }
            
            // Update starred count
            await this.updateStarredCount();
            
            // Also update the cookie-based list so listings.js starredListings array stays in sync
            if (window.starredListings) {
                const idx = window.starredListings.indexOf(normalizedId);
                if (isStarred && idx > -1) {
                    window.starredListings.splice(idx, 1);
                } else if (!isStarred && idx === -1) {
                    window.starredListings.push(normalizedId);
                }
            }
            
            return !isStarred;
        } catch (error) {
            console.error('Error toggling star:', error);
            this.showToast('Error updating starred status');
            return false;
        }
    },
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    updateStarButtons(listingId, isStarred) {
        // Update star buttons matched by data-listing-id attribute
        const starButtons = document.querySelectorAll(`[data-listing-id="${listingId}"]`);
        starButtons.forEach(btn => {
            if (isStarred) {
                btn.classList.add('starred');
            } else {
                btn.classList.remove('starred');
            }
        });

        // Also update star buttons matched by onclick pattern (used in listings.js rendered cards)
        const allStarButtons = document.querySelectorAll('.star-button');
        allStarButtons.forEach(btn => {
            const onclick = btn.getAttribute('onclick') || '';
            if (onclick.includes(listingId)) {
                if (isStarred) {
                    btn.classList.add('starred');
                } else {
                    btn.classList.remove('starred');
                }
            }
        });
    },
    
    async updateStarredCount() {
        try {
            await window.PWAStorage.init();
            const starred = await window.PWAStorage.getAllStarred();
            const count = starred.length;
            
            // Update count in header/dock
            const countElements = document.querySelectorAll('#starredCount, .starred-count, #headerStarredCount');
            countElements.forEach(el => {
                el.textContent = count;
            });
            
            return count;
        } catch (error) {
            console.error('Error updating starred count:', error);
            return 0;
        }
    },
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    async renderStarredListings(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        try {
            await window.PWAStorage.init();
            const starred = await window.PWAStorage.getAllStarred();
            
            if (starred.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12">
                        <div class="text-6xl mb-4">⭐</div>
                        <h3 class="text-xl font-bold text-gray-900 mb-2">No starred listings yet</h3>
                        <p class="text-gray-600 mb-6">Star your favorite businesses to see them here</p>
                        <a href="/listings.html" class="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            Browse Listings
                        </a>
                    </div>
                `;
                return;
            }
            
            // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
            
            container.innerHTML = starred.map(listing => {
                const categorySlug = listing.category?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'general';
                const listingUrl = `/listing/${listing.slug}`;
                const firstPhoto = listing.photos && listing.photos.length > 0 ? listing.photos[0] : (listing.logo || '');
                const logoImage = listing.logo || '';
                const checkmarkHtml = listing.tier === 'FEATURED' || listing.tier === 'PREMIUM' || listing.is_claimed || listing.show_claim_button === false
                    ? '<svg style="width:20px;height:20px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#045193"></circle><path d="M7 12.5l3.5 3.5L17 9" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
                    : '';
                
                return `
                    <a href="${listingUrl}" class="listing-card bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden block">
                        <div class="h-48 bg-gray-200 relative listing-image-container">
                            ${firstPhoto ? `<img src="${firstPhoto}" alt="${listing.business_name}" class="listing-image w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-gray-400">No image</div>'}
                            <button class="star-button starred" data-listing-id="${listing.id}" onclick="window.StarredManager.handleStarClick('${listing.id}', event)">
                                <svg class="star-icon" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                            </button>
                        </div>
                        <div class="p-4">
                            <div class="flex gap-3 mb-3">
                                ${logoImage ? `<img src="${logoImage}" alt="${listing.business_name} logo" class="listing-logo w-16 h-16 rounded object-cover flex-shrink-0">` : '<div class="w-16 h-16 rounded bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">No logo</div>'}
                                <div class="flex-1 min-w-0">
                                    <span class="listing-category text-xs font-semibold px-2 py-1 rounded-full text-white block w-fit mb-2" style="background-color:#045093;">${listing.category || 'General'}</span>
                                    <h3 class="listing-name text-lg font-bold text-gray-900 line-clamp-1" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${listing.business_name}${checkmarkHtml}</h3>
                                </div>
                            </div>
                            <p class="listing-tagline text-sm text-gray-600 mb-3 line-clamp-2">${listing.tagline || listing.description || ''}</p>
                            <p class="listing-location text-sm text-gray-600" style="display:flex;align-items:center;gap:8px;"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg><span>${listing.city ? `${listing.city}, ${listing.state}` : (listing.address || 'Location not specified')}</span></p>
                        </div>
                    </a>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Error rendering starred listings:', error);
            container.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-red-600">Error loading starred listings</p>
                </div>
            `;
        }
    },
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    async handleStarClick(listingId, event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Get listing data from current page if available
        let listingData = null;
        if (window.currentListingData && window.currentListingData.id === listingId) {
            listingData = window.currentListingData;
        } else if (window.allListings) {
            listingData = window.allListings.find(l => l.id === listingId);
        }
        
        if (!listingData) {
            // Try to get from Supabase
            try {
                const { data, error } = await window.supabase.createClient(
                    'https://luetekzqrrgdxtopzvqw.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg'
                )
                    .from('listings')
                    .select('*')
                    .eq('id', listingId)
                    .single();
                
                if (!error && data) {
                    listingData = data;
                }
            } catch (e) {
                console.error('Error fetching listing:', e);
            }
        }
        
        await this.toggleStar(listingId, listingData);
        
        // If on starred page, refresh the list
        if (window.location.pathname.includes('starred')) {
            this.renderStarredListings('starredListingsContainer');
        }
    },
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    showToast(message) {
        // Check if toast exists
        let toast = document.querySelector('.pwa-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'pwa-toast';
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    },
    

    listenForStarredChanges() {
        const handle = async () => {
            await this.updateStarredCount();
            if (window.location.pathname.includes('starred')) {
                this.renderStarredListings('starredListingsContainer');
            }
            this.initializeStarButtons();
        };

        window.addEventListener('tgd:starred-changed', handle);
        window.addEventListener('storage', (event) => {
            if (event.key === 'tgd_starred_sync') {
                handle();
            }
        });
    },

    // The starredListings cookie is the primary store of starred listing IDs: the directory page
    // writes it in every browser and only mirrors it into IndexedDB in PWA mode. Parsed the same
    // way as getStarredListingIds() in js/listing-page.js.
    getCookieStarredIds() {
        try {
            const cookieEntry = document.cookie.split('; ').find((item) => item.startsWith('starredListings='));
            if (!cookieEntry) return [];
            const parsed = JSON.parse(decodeURIComponent(cookieEntry.slice('starredListings='.length)));
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch (error) {
            return [];
        }
    },

    async initializeStarButtons() {
        try {
            await window.PWAStorage.init();
            
            // Find all star buttons — some have data-listing-id, others use onclick pattern
            const starButtons = document.querySelectorAll('.star-button');
            for (const button of starButtons) {
                let listingId = button.getAttribute('data-listing-id');
                
                // Fallback: extract ID from onclick="toggleStar('ID', event)"
                if (!listingId) {
                    const onclick = button.getAttribute('onclick') || '';
                    const match = onclick.match(/toggleStar\(\s*['"]([^'"]+)['"]/);
                    if (match) listingId = match[1];
                }
                
                if (!listingId) continue;
                
                // Starred if either store has it. Checking IndexedDB alone removed the class that
                // js/listing-page.js had just applied from the cookie, so a listing starred from the
                // directory in a normal browser tab showed as unstarred.
                const isStarred = (await window.PWAStorage.isStarred(String(listingId))) ||
                    this.getCookieStarredIds().includes(String(listingId));
                if (isStarred) {
                    button.classList.add('starred');
                } else {
                    button.classList.remove('starred');
                }
            }
            
            // Update starred count
            await this.updateStarredCount();
        } catch (error) {
            console.error('Error initializing star buttons:', error);
        }
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

// Initialize on page load
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.StarredManager.initializeStarButtons();
        });
    } else {
        window.StarredManager.initializeStarButtons();
    }
}

// Make handleStarClick globally available
window.handleStarClick = function(listingId, event) {
    window.StarredManager.handleStarClick(listingId, event);
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. For more information, visit https://thegreekdirectory.org/legal.


if (window.StarredManager) {
    window.StarredManager.listenForStarredChanges();
}
