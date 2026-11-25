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
    events: '/rest/admin/events',
    updateEvent: (id: string) => `/rest/admin/events/${id}`,
    updateEventStatus: (id: string) => `/rest/admin/events/${id}/status`,
    deleteEvent: (id: string) => `/rest/admin/events/${id}`,
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
    // Moderation (social, phase 4).
    reports: '/rest/admin/reports',
    reviewReport: (id: string) => `/rest/admin/reports/${id}`,
    banUser: (id: string) => `/rest/admin/users/${id}/ban`,
    unbanUser: (id: string) => `/rest/admin/users/${id}/unban`,
    bannedUsers: '/rest/admin/users/banned',
  },

  users: {
    myFavoritesIds: '/rest/users/me/favorites/ids',
    myFavorites: '/rest/users/me/favorites',
    myAttendance: '/rest/users/me/attendance',
    profile: (id: string) => `/rest/users/${id}`,
    // Social (social-plan.md).
    profileByUsername: (username: string) => `/rest/users/by-username/${encodeURIComponent(username)}`,
    attendance: (id: string) => `/rest/users/${id}/attendance`,
    follow: (id: string) => `/rest/users/${id}/follow`,
    block: (id: string) => `/rest/users/${id}/block`,
    report: (id: string) => `/rest/users/${id}/report`,
    invites: (id: string) => `/rest/users/${id}/invites`,
    myFollowers: '/rest/users/me/followers',
    myFollowing: '/rest/users/me/following',
    myFriends: '/rest/users/me/friends',
    myBlocks: '/rest/users/me/blocks',
    myFeed: '/rest/users/me/feed',
    mySuggestions: '/rest/users/me/suggestions',
    myNotifications: '/rest/users/me/notifications',
    myUnreadCount: '/rest/users/me/notifications/unread-count',
    myNotificationsRead: '/rest/users/me/notifications/read',
    myEmailNotifications: '/rest/users/me/email-notifications',
    myAvatar: '/rest/users/me/avatar',
    myAvatarSource: '/rest/users/me/avatar/source',
    myUsername: '/rest/users/me/username',
    usernameAvailable: '/rest/users/username-available',
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
    // Social (social-plan.md, phases 3 and 6).
    myAttendance: (id: string) => `/rest/events/${id}/attendance/me`,
    friendsGoing: (id: string) => `/rest/events/${id}/friends-going`,
    inviteFriends: (id: string) => `/rest/events/${id}/invites/friends`,
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
    myEvents: '/rest/organizers/me/events',
    update: (id: string) => `/rest/organizers/${id}`,
    list: '/rest/organizers',
    events: (id: string) => `/rest/organizers/${id}/events`,
    venues: (id: string) => `/rest/organizers/${id}/venues`,
    eventSeries: (id: string) => `/rest/organizers/${id}/event-series`,
    delete: (id: string) => `/rest/organizers/${id}`,
    logo: (id: string) => `/rest/organizers/${id}/logo`,
    release: (id: string) => `/rest/organizers/${id}/release`,
    /** Verified SCHOOL organizers by name: "Scuola o crew" in the profile. */
    schools: '/rest/organizers/schools',
  },

}