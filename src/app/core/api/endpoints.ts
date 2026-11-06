export const endpoints = {

  auth: {
    googleLogin: '/oauth2/authorization/google',
    me: '/rest/auth/me',
    updateMe: '/rest/auth/me',
    logout: '/rest/auth/logout',
  },

  admin: {
    getVerifiedOrganizers: '/rest/admin/organizers/verified',//Used
    createUnclaimedOrganizer: '/rest/admin/organizers/unclaimed',//Used
    getOrganizer: (id: string) => `/rest/admin/organizers/${id}`,//Used
    updateOrganizer: (id: string) => `/rest/admin/organizers/${id}`,//Used
    deleteOrganizer: (id: string) => `/rest/admin/organizers/${id}`,//Used
    unclaimOrganizer: (id: string) => `/rest/admin/organizers/${id}/unclaim`,
    createEvent: '/rest/admin/events',//Used
    updateEventFlyer: (id: string) => `/rest/admin/events/${id}/flyer`,//Used
    deleteEventFlyer: (id: string) => `/rest/admin/events/${id}/flyer`,
    createEventSeries: '/rest/admin/event-series',
    updateEventSeriesFlyer: (seriesId: string) => `/rest/admin/event-series/${seriesId}/flyer`,
    generateEventSeriesOccurrences: (id: string) => `/rest/admin/event-series/${id}/occurrences`,
    createVenue: '/rest/admin/venues',
    updateVenue: (id: string) => `/rest/admin/venues/${id}`,//Used
    deleteVenue: (id: string) => `/rest/admin/venues/${id}`,//Used
    updateVenueLogo: (id: string) => `/rest/admin/venues/${id}/logo`,//Used
    deleteVenueLogo: (id: string) => `/rest/admin/venues/${id}/logo`,//Used
    organizerRequests: '/rest/admin/organizer-requests',
    approveOrganizerRequest: (id: string) => `/rest/admin/organizer-requests/${id}/approve`,
    rejectOrganizerRequest: (id: string) => `/rest/admin/organizer-requests/${id}/reject`,
  },

  users: {
    myFavoritesIds: '/rest/users/me/favorites/ids',
    myFavorites: '/rest/users/me/favorites',
    myAttendance: '/rest/users/me/attendance'
  },

  cities: {
    list: '/rest/cities',
    detail: (id: number) => `rest/cities/${id}`,
  },

  danceStyles: {
    list: '/rest/dance-styles',
    details: (id: number) => `/rest/dance-styles/${id}`,
  },

  // Read-only: venues are created and edited by the admin (see admin.createVenue/updateVenue).
  venues: {
    list: '/rest/venues',
    map: '/rest/venues/map',
    detail: (id: string) => `/rest/venues/${id}`,
  },

  events: {
    mapEvents: '/rest/events',
    detail: (id: string) => `/rest/events/${id}`,
    create: '/rest/events',
    update: (id: string) => `/rest/events/${id}`,
    updateStatus: (id: string) => `/rest/events/${id}/status`,
    delete: (id: string) => `/rest/events/${id}`,
    removeVenue: (id: string) => `/rest/events/${id}/venue`,
    attendees: (id: string) => `/rest/events/${id}/attendees`,
    addAttendance: (id: string) => `/rest/events/${id}/attendance`,
    removeAttendance: (id: string) => `/rest/events/${id}/attendance`,
    isGoing: (id:string) => `/rest/events/${id}/going`,
    addFavorite: (id: string) => `/rest/events/${id}/favorite`,
    removeFavorite: (id: string) => `/rest/events/${id}/favorite`,
    isFavorite: (id: string) => `/rest/events/${id}/favorite`,
    updateFlyer: (id: string) => `/rest/events/${id}/flyer`,
    deleteFlyer: (id: string) => `/rest/events/${id}/flyer`,
  },

  eventSeries: {
    detail: (id: string) => `/rest/event-series/${id}`,
    create: '/rest/event-series',
    update: (id: string) => `/rest/event-series/${id}`,
    delete: (id: string) => `/rest/event-series/${id}`,
    removeVenue: (id: string) => `/rest/event-series/${id}/venue`,
    generateOccurrences: (id: string) => `/rest/event-series/${id}/occurrences`,
  },

  organizerRequests: {
    create: '/rest/organizer-requests',
    me: '/rest/organizer-requests/me',
    logo: (id: string) => `/rest/organizer-requests/${id}/logo`,
    cancel: (id: string) => `/rest/organizer-requests/${id}`,
    acknowledge: (id: string) => `/rest/organizer-requests/${id}/acknowledge`,
  },

  organizers: {
    claimable: '/rest/organizers/claimable',
    getBySlug: (slug: string) => `/rest/organizers/${slug}`,
    myOrganizers: '/rest/organizers/me',
    update: (id: string) => `/rest/organizers/${id}`,
    list: '/rest/organizers',
    events: (id: string) => `/rest/organizers/${id}/events`,
    venues: (id: string) => `/rest/organizers/${id}/venues`,
    eventSeries: (id: string) => `/rest/organizers/${id}/event-series`,
    delete: (id: string) => `/rest/organizers/${id}`,
  },

}