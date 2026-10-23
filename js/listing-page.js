function openDirections(event) {
        if (event) event.preventDefault();
        const listing = window.currentListingData || {};
        const directionsUrl = (window.TGDDirections && window.TGDDirections.getDirectionsUrl)
            ? window.TGDDirections.getDirectionsUrl(listing)
            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((listing.address || '') + ' ' + (listing.city || '') + ' ' + (listing.state || ''))}`;
        window.open(directionsUrl, '_blank', 'noopener');
    }
        
    function getStarredListingIds() {
        const cookieEntry = document.cookie.split('; ').find((item) => item.startsWith('starredListings='));
        if (!cookieEntry) return [];
        try {
            const parsed = JSON.parse(decodeURIComponent(cookieEntry.split('=')[1]));
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch (error) {
            return [];
        }
    }

    function setStarredListingIds(ids) {
        const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
        document.cookie = `starredListings=${encodeURIComponent(JSON.stringify(ids))}; expires=${expires}; path=/; SameSite=Lax`;
    }

    async function toggleListingStar(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!window.currentListingData) return;
        const listingId = String(window.currentListingData.id);
        const starButton = document.querySelector(`.star-button[data-listing-id="${listingId}"]`);
        if (!starButton) return;

        // A listing counts as starred if the cookie OR IndexedDB has it (see the DOMContentLoaded
        // handler below), so the toggle follows what the button currently shows. Deciding from the
        // cookie alone re-starred the listing, and never unstarred it, when only IndexedDB held the star.
        const shouldStar = !starButton.classList.contains('starred');

        const starredIds = getStarredListingIds().filter((id) => id !== listingId);
        if (shouldStar) starredIds.push(listingId);

        setStarredListingIds(starredIds);
        starButton.classList.toggle('starred', shouldStar);
        window.dispatchEvent(new CustomEvent('tgd:starred-changed', {
            detail: { action: shouldStar ? 'added' : 'removed', listingId, timestamp: Date.now() }
        }));

        if (window.PWAStorage) {
            try {
                await window.PWAStorage.init();
                if (shouldStar) {
                    // addStarred() uses objectStore.add(), which rejects if the listing is already stored
                    const alreadyStarred = await window.PWAStorage.isStarred(listingId);
                    if (!alreadyStarred) await window.PWAStorage.addStarred(window.currentListingData);
                } else {
                    await window.PWAStorage.removeStarred(listingId);
                }
            } catch (error) {
                console.error('Error syncing starred listing to PWA storage:', error);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (!window.currentListingData) return;
        const starButton = document.querySelector(`.star-button[data-listing-id="${window.currentListingData.id}"]`);
        if (!starButton) return;
        const listingId = String(window.currentListingData.id);
        const isStarredByCookie = getStarredListingIds().includes(listingId);
        if (isStarredByCookie) starButton.classList.add('starred');
        if (window.PWAStorage) {
            try {
                await window.PWAStorage.init();
                const isStarred = await window.PWAStorage.isStarred(listingId);
                if (isStarred) starButton.classList.add('starred');
            } catch (error) {
                console.error('Error reading starred listing from PWA storage:', error);
            }
        }
    });

    function handleListingHashRoute() {
        const hash = (window.location.hash || '').toLowerCase();
        const targets = {
            '#carousel': 'carouselSection',
            '#header': 'headerSection',
            '#description': 'descriptionSection',
            '#map': 'locationSection',
            '#contact': 'contactSection',
            '#additional': 'additionalInfoSectionWrap',
            '#owner': 'ownerInfoSection',
            '#social': 'socialSection',
            '#related': 'relatedSection',
            '#claim': 'claimSection'
        };
        const targetId = targets[hash];
        if (!targetId) return;
        const target = document.getElementById(targetId);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.addEventListener('DOMContentLoaded', handleListingHashRoute);
    window.addEventListener('hashchange', handleListingHashRoute);


        const SUPABASE_URL = 'https://luetekzqrrgdxtopzvqw.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg';
        
        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const hoursServerTimeEndpoint = 'https://luetekzqrrgdxtopzvqw.supabase.co/functions/v1/listing-server-time';
        const hoursServerAuth = { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` };
        let currentGalleryIndex = 0;
        
        function toggleSubcategories() {
            const display = document.getElementById('subcategoriesDisplay');
            display.classList.toggle('active');
        }
        
        function formatPhoneDisplay(phone) {
            if (!phone) return '';
            const digits = phone.replace(/\D/g, '');
            if (digits.length === 11 && digits.startsWith('1')) {
                return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
            }
            if (digits.length === 10) {
                return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
            }
            return phone;
        }
        
        /* Copyright (C) The Greek Directory, 2025-present. All rights reserved. */
        
        document.addEventListener('DOMContentLoaded', () => {
            if (window.TGDLanguage && typeof window.TGDLanguage.applyStoredLanguage === 'function') {
                window.TGDLanguage.applyStoredLanguage();
            }
            document.querySelectorAll('.text-gray-600, .text-gray-700').forEach(el => {
                const phone = el.textContent.match(/\b1?\d{10}\b/);
                if (phone) {
                    el.textContent = el.textContent.replace(phone[0], formatPhoneDisplay(phone[0]));
                }
            });
        });
        
        async function trackAnalytics(action, platform) {
            try {
                const { data, error } = await supabaseClient
                    .from('listing_analytics')
                    .insert({
                        listing_id: window.currentListingData.id,
                        action: action,
                        platform: platform || null,
                        timestamp: new Date().toISOString(),
                        user_agent: navigator.userAgent
                    });
                
                if (error) throw error;
            } catch (e) {
                console.log('Analytics tracking error:', e.message);
            }
        }
        
        window.addEventListener('load', () => {
            trackAnalytics('view');
        });
        
        function trackClick(action, platform) {
            trackAnalytics(action, platform);
        }
        
        /* Copyright (C) The Greek Directory, 2025-present. All rights reserved. */
        
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('a[href^="tel:"]').forEach(el => {
                el.addEventListener('click', () => trackClick('call'));
            });
            
            document.querySelectorAll('a[href*="maps"]').forEach(el => {
                el.addEventListener('click', () => trackClick('directions'));
            });
            
            if (window.currentListingData.website_domain) {
                document.querySelectorAll('a[href]').forEach(el => {
                    const href = el.getAttribute('href') || '';
                    let parsedUrl;
                    try {
                        parsedUrl = new URL(href, window.location.origin);
                    } catch (error) {
                        return;
                    }
                    const isWebLink = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
                    if (!isWebLink) return;
                    if (parsedUrl.hostname !== window.currentListingData.website_domain) return;
                    el.addEventListener('click', () => trackClick('website'));
                });
            }

            document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
                el.addEventListener('click', () => trackClick('email'));
            });

            document.querySelectorAll('[data-cta-name]').forEach(el => {
                el.addEventListener('click', () => trackClick('custom_cta_1'));
            });

            checkAdminRedirect();
            initializeReadMore();
            initializeTooltipToggle('verifiedCheckmarkButton');
            initializeTooltipToggle('hoursTooltipButton');
            initializeListingHoursStatus();
        });

        function initializeTooltipToggle(buttonId) {
            const button = document.getElementById(buttonId);
            if (!button) return;
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                button.classList.toggle('open');
            });
            document.addEventListener('click', () => button.classList.remove('open'));
        }

        function initializeReadMore() {
            const description = document.getElementById('listingDescription');
            const readMoreButton = document.getElementById('listingReadMoreBtn');
            if (!description || !readMoreButton) return;
            if (description.scrollHeight <= 300) return;

            let expanded = false;
            description.classList.add('collapsed');
            readMoreButton.classList.remove('hidden');

            readMoreButton.addEventListener('click', () => {
                expanded = !expanded;
                description.classList.toggle('collapsed', !expanded);
                readMoreButton.textContent = expanded ? 'Read less' : 'Read more';
            });
        }
        
        function checkAdminRedirect() {
            const path = window.location.pathname;
            if (path.endsWith('/admin')) {
                const slug = window.currentListingData.id;
                window.location.href = `/business.html?slug=${slug}`;
            }
        }

        /* Copyright (C) The Greek Directory, 2025-present. All rights reserved. */

                async function initializeListingHoursStatus() {
            if (typeof window.TGDListingHours?.updateOpenClosedBadge !== 'function') return;
            await window.TGDListingHours.updateOpenClosedBadge({
                hoursData: window.currentListingData.hours,
                businessTimezone: window.currentListingData.timezone,
                hoursServerTimeEndpoint,
                hoursServerAuth
            });
        }

function openGallery(index = 0) {
            const modal = document.getElementById('galleryModal');
            if (!modal || !window.currentListingData.photos || window.currentListingData.photos.length === 0) return;
            modal.classList.add('active');
            currentGalleryIndex = index;
            updateGallerySlide();
        }

        function closeGallery() {
            const modal = document.getElementById('galleryModal');
            if (!modal) return;
            modal.classList.remove('active');
        }

        function updateGallerySlide() {
            const image = document.getElementById('galleryImage');
            const counter = document.getElementById('galleryCounter');
            if (!image || !window.currentListingData.photos || window.currentListingData.photos.length === 0) return;
            image.src = window.currentListingData.photos[currentGalleryIndex];
            if (counter) {
                counter.textContent = `${currentGalleryIndex + 1} / ${window.currentListingData.photos.length}`;
            }
        }

        function nextGallerySlide() {
            if (!window.currentListingData.photos || window.currentListingData.photos.length === 0) return;
            currentGalleryIndex = (currentGalleryIndex + 1) % window.currentListingData.photos.length;
            updateGallerySlide();
        }

        function prevGallerySlide() {
            if (!window.currentListingData.photos || window.currentListingData.photos.length === 0) return;
            currentGalleryIndex = (currentGalleryIndex - 1 + window.currentListingData.photos.length) % window.currentListingData.photos.length;
            updateGallerySlide();
        }

        if (window.currentListingData.total_photos > 1) {
            function goToSlide(index) {
                const carousel = document.getElementById('photoCarousel');
                if (!carousel) return;
                const track = carousel.querySelector('.carousel-track');
                const dots = carousel.querySelectorAll('.carousel-dot');
                
                track.style.transform = `translateX(-${index * 100}%)`;
                dots.forEach((dot, i) => {
                    dot.classList.toggle('active', i === index);
                });
                carousel.dataset.current = index;
            }

            function nextSlide() {
                const carousel = document.getElementById('photoCarousel');
                if (!carousel) return;
                const current = parseInt(carousel.dataset.current || 0);
                goToSlide((current + 1) % window.currentListingData.total_photos);
            }

            function prevSlide() {
                const carousel = document.getElementById('photoCarousel');
                if (!carousel) return;
                const current = parseInt(carousel.dataset.current || 0);
                goToSlide((current - 1 + window.currentListingData.total_photos) % window.currentListingData.total_photos);
            }

            setInterval(nextSlide, 5000);
            
            window.goToSlide = goToSlide;
            window.nextSlide = nextSlide;
            window.prevSlide = prevSlide;
        }

        window.openGallery = openGallery;
        window.closeGallery = closeGallery;
        window.nextGallerySlide = nextGallerySlide;
        window.prevGallerySlide = prevGallerySlide;

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            closeGallery();
            const shareModal = document.getElementById('shareModal');
            if (shareModal && shareModal.classList.contains('active')) {
                closeShareModal();
            }
        });

        function shareNative() {
            trackClick('share', 'native');
            if (navigator.share) {
                navigator.share({
                    title: window.currentListingData.business_name_display + ' | The Greek Directory',
                    text: 'Check out ' + window.currentListingData.business_name_display + ' on The Greek Directory!',
                    url: window.location.href.split('?')[0] + '?utm_source=native&utm_medium=share&utm_campaign=listing'
                }).catch(err => {
                    if (err.name !== 'AbortError') {
                        console.log('Share failed:', err);
                    }
                });
            } else {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    const label = document.getElementById('shareCopyLabel');
                    if (label) {
                        const original = label.textContent;
                        label.textContent = 'Link copied to clipboard!';
                        setTimeout(() => { label.textContent = original; }, 1800);
                    }
                }).catch(() => {
                    console.log('Unable to share. Please copy the URL from your browser.');
                });
            }
        }

        function openShareModal() {
            const modal = document.getElementById('shareModal');
            const source = document.getElementById('shareButtonsSection');
            const target = document.getElementById('shareModalButtons');
            if (!modal || !source || !target) return;
            target.innerHTML = source.querySelector('.flex') ? source.querySelector('.flex').innerHTML : '';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            requestAnimationFrame(() => modal.classList.add('active'));
        }

        function closeShareModal() {
            const modal = document.getElementById('shareModal');
            if (!modal) return;
            modal.classList.remove('active');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function copyShareLink() {
            const input = document.getElementById('shareLinkInput');
            const label = document.getElementById('shareCopyLabel');
            if (!input) return;
            navigator.clipboard.writeText(input.value).then(() => {
                if (label) {
                    const original = label.textContent;
                    label.textContent = 'Link copied to clipboard!';
                    setTimeout(() => {
                        label.textContent = original;
                    }, 1800);
                }
            }).catch(() => {
                input.select();
                document.execCommand('copy');
                if (label) {
                    const original = label.textContent;
                    label.textContent = 'Link copied to clipboard!';
                    setTimeout(() => {
                        label.textContent = original;
                    }, 1800);
                }
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            const claimSection = document.getElementById('claimSection');
            if (claimSection) {
                const socialSection = document.getElementById('socialSection');
                const hasSocialOrReviews = !!document.querySelector('#socialSection h2');
                const targetSelectors = [
                    '#ownerInfoSection .owner-info-section',
                    '#additionalInfoSectionWrap > div',
                    '#locationSection',
                    '#descriptionSection'
                ];
                const target = (socialSection && hasSocialOrReviews)
                    ? socialSection
                    : targetSelectors
                        .map((selector) => document.querySelector(selector))
                        .find((element) => element);
                if (target && target.parentNode) {
                    target.insertAdjacentElement('afterend', claimSection);
                }
            }

            const input = document.getElementById('shareLinkInput');
            const toggle = document.getElementById('shortenUrlToggle');
            if (toggle && input) {
                toggle.addEventListener('change', (event) => {
                    input.value = event.target.checked ? `${window.currentListingData.shortlink}` : `https://thegreekdirectory.org/listing/${window.currentListingData.slug}`;
                });
            }
        });

        /* Copyright (C) The Greek Directory, 2025-present. All rights reserved. */

        async function geocodeAddress(address) {
            try {
                const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
                const response = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
                if (!response.ok) return null;
                const data = await response.json();
                if (!Array.isArray(data) || !data.length) return null;
                return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            } catch (_) {
                return null;
            }
        }
        
        async function initializeMap() {
            const mapFallback = document.getElementById('mapFallback');
            const showMapFallback = (message) => {
                if (mapFallback) {
                    mapFallback.textContent = message || 'Map is currently unavailable for this listing.';
                    mapFallback.classList.add('visible');
                }
                const locationSection = document.getElementById('locationSection');
                if (locationSection) locationSection.classList.add('map-unavailable');
            };

            const locationSection = document.getElementById('locationSection');
            if (!locationSection) {
                return;
            }

            if (!window.currentListingData.full_address || window.currentListingData.full_address === '') {
                locationSection.remove();
                return;
            }
            
            const mapElement = document.getElementById('listingMap');
            if (!mapElement) {
                return;
            }
            
            try {
                let lat;
                let lng;

                if (window.currentListingData.coordinates && window.currentListingData.coordinates.includes(',')) {
                    const coords = window.currentListingData.coordinates.split(',');
                    lat = parseFloat(coords[0].trim());
                    lng = parseFloat(coords[1].trim());
                }

                if (isNaN(lat) || isNaN(lng)) {
                    const geocoded = await geocodeAddress(window.currentListingData.full_address);
                    if (!geocoded) {
                        showMapFallback('We could not load this map right now. Please use Directions for navigation.');
                        return;
                    }
                    [lat, lng] = geocoded;
                }
                
                if (typeof L === 'undefined') {
                    setTimeout(initializeMap, 500);
                    return;
                }
                
                const map = L.map('listingMap', {
                    center: [lat, lng],
                    zoom: 15,
                    zoomControl: true,
                    scrollWheelZoom: false
                });
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '',
                    maxZoom: 19
                }).addTo(map);
                
                const listingMapPinIcon = L.divIcon({
                    className: 'listing-map-pin',
                    html: `<div style="width:25px;height:41px;display:flex;align-items:flex-end;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="800px" height="800px" viewBox="0 0 24 24" fill="none" style="width:25px;height:41px;display:block;"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.3856 23.789L11.3831 23.7871L11.3769 23.7822L11.355 23.765C11.3362 23.7501 11.3091 23.7287 11.2742 23.7008C11.2046 23.6451 11.1039 23.5637 10.9767 23.4587C10.7224 23.2488 10.3615 22.944 9.92939 22.5599C9.06662 21.793 7.91329 20.7041 6.75671 19.419C5.60303 18.1371 4.42693 16.639 3.53467 15.0528C2.64762 13.4758 2 11.7393 2 10C2 7.34784 3.05357 4.8043 4.92893 2.92893C6.8043 1.05357 9.34784 0 12 0C14.6522 0 17.1957 1.05357 19.0711 2.92893C20.9464 4.8043 22 7.34784 22 10C22 11.7393 21.3524 13.4758 20.4653 15.0528C19.5731 16.639 18.397 18.1371 17.2433 19.419C16.0867 20.7041 14.9334 21.793 14.0706 22.5599C13.6385 22.944 13.2776 23.2488 13.0233 23.4587C12.8961 23.5637 12.7954 23.6451 12.7258 23.7008C12.6909 23.7287 12.6638 23.7501 12.645 23.765L12.6231 23.7822L12.6169 23.7871L12.615 23.7885C12.615 23.7885 12.6139 23.7894 12 23L12.6139 23.7894C12.2528 24.0702 11.7467 24.0699 11.3856 23.789ZM12 23L11.3856 23.789C11.3856 23.789 11.3861 23.7894 12 23ZM15 10C15 11.6569 13.6569 13 12 13C10.3431 13 9 11.6569 9 10C9 8.34315 10.3431 7 12 7C13.6569 7 15 8.34315 15 10Z" fill="#045093"/></svg></div>`,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34]
                });
                L.marker([lat, lng], { icon: listingMapPinIcon }).addTo(map)
                    .bindPopup(`<strong>${window.currentListingData.business_name}</strong><br>${window.currentListingData.full_address}`)
                    .openPopup();
                
                setTimeout(() => {
                    map.invalidateSize();
                }, 250);
                
                mapElement.addEventListener('click', function() {
                    this.classList.add('active');
                    map.scrollWheelZoom.enable();
                });

                mapElement.addEventListener('mouseleave', function() {
                    this.classList.remove('active');
                    map.scrollWheelZoom.disable();
                });
            } catch (e) {
                console.error('Map error:', e);
                showMapFallback('Map failed to load. Please try again later.');
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(initializeMap, 1000);
            });
        } else {
            setTimeout(initializeMap, 1000);
        }
        
        initializeListingHoursStatus();
        setInterval(initializeListingHoursStatus, 60000);
