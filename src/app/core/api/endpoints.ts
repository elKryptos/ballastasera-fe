export const endpoints = {

  auth: {
    googleLogin: '/oauth2/authorization/google',
    me: '/rest/auth/me',
    updateMe: '/rest/auth/me',
    logout: '/rest/auth/logout',
  },

  admin: {
    pendingOrganizers: '/rest/admin/organizers/pending',
    verifyOrganizer: (id: string) => `/rest/admin/organizers/${id}/verify`,
    createUnclaimedOrganizer: '/rest/organizers/unclaimed',
    claimOrganizer: (id: string) => `/rest/organizers/${id}/claim`,
    createEvent: '/rest/admin/events',
    updateEventFlyer: (id: string) => `/rest/admin/events/${id}/flyer`,
    deleteEventFlyer: (id: string) => `/rest/admin/events/${id}/flyer`,
    createEventSeries: '/rest/admin/event-series',
    createVenue: '/rest/admin/venues',
    deleteVenue: (id: string) => `/rest/admin/venues/${id}`,
  },

  users: {
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

  venues: {
    list: '/rest/venues',
    create: '/rest/venues',
    update: (id: string) => `/rest/venues/${id}`,
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
    setAttendance: (id: string) => `/rest/events/${id}/attendance`,
    removeAttendance: (id: string) => `/rest/events/${id}/attendance`,
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
  },

  organizers: {
    create: '/rest/organizers',
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