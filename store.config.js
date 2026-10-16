// App Store listing for DriveWatch. Upload it from the project folder with:
//   $env:REVIEW_PHONE="+1 330 555 0100"; npx eas-cli@latest metadata:push
// The phone number is only for Apple's reviewers and is kept out of git.
// Screenshots are made from store/source (see store/source/shoot.js).

const API = 'https://drivewatch-api.noisy-sunset-3f0d.workers.dev';

const phone = process.env.REVIEW_PHONE;
if (!phone && process.argv.some((a) => a.startsWith('metadata:push'))) {
  throw new Error('Set REVIEW_PHONE first, like: $env:REVIEW_PHONE="+1 330 555 0100"');
}

module.exports = {
  configVersion: 0,
  apple: {
    // App Store version this listing is for; keep in step with app.json "version".
    version: '1.0.0',
    copyright: '2026 Doug Weil',
    categories: ['NAVIGATION', 'LIFESTYLE'],
    advisory: {
      alcoholTobaccoOrDrugUseOrReferences: 'NONE',
      contests: 'NONE',
      gamblingSimulated: 'NONE',
      horrorOrFearThemes: 'NONE',
      matureOrSuggestiveThemes: 'NONE',
      medicalOrTreatmentInformation: 'NONE',
      profanityOrCrudeHumor: 'NONE',
      sexualContentGraphicAndNudity: 'NONE',
      sexualContentOrNudity: 'NONE',
      violenceCartoonOrFantasy: 'NONE',
      violenceRealistic: 'NONE',
      violenceRealisticProlongedGraphicOrSadistic: 'NONE',
      gunsOrOtherWeapons: 'NONE',
      gambling: false,
      unrestrictedWebAccess: false,
      lootBox: false,
      advertising: false,
      ageAssurance: false,
      healthOrWellnessTopics: false,
      messagingAndChat: false,
      parentalControls: false,
      userGeneratedContent: false,
      kidsAgeBand: null,
      ageRatingOverride: 'NONE',
      koreaAgeRatingOverride: 'NONE',
    },
    info: {
      'en-US': {
        title: 'DriveWatch: Teen Driver Alerts',
        subtitle: 'Alerts for phone use at speed',
        promoText: 'Get an alert within seconds when your new driver picks up their phone at 25 mph or faster.',
        keywords: [
          'teen driver',
          'texting',
          'distracted driving',
          'parent',
          'family',
          'safe driving',
          'speed',
          'location',
          'new driver',
          'tracker',
        ],
        description: [
          'DriveWatch helps parents of new drivers. It logs every drive on its own and tells you within seconds when your teen\'s phone is used while the car is going 25 mph or faster.',
          '',
          'WHAT PARENTS GET',
          '- Phone-use alerts: the phone was unlocked, picked up and handled, or used for a call held to the ear while moving.',
          '- High-speed alerts at a speed you choose.',
          '- Live location and speed while your teen is driving.',
          '- Drive history with a map of each route and where any phone use happened.',
          '- An alert if location tracking is switched off or the phone stops reporting mid-drive.',
          '- Your own rules: set the phone-use speed and the top-speed alert.',
          '',
          'BUILT FOR THE DRIVER TOO',
          '- Nothing to tap while driving. Drives start and stop on their own.',
          '- Rides as a passenger can be marked "I was a passenger".',
          '- Hands-free calls over Bluetooth or CarPlay don\'t count as phone use.',
          '',
          'HOW IT WORKS',
          'A parent starts a family and makes a one-time code. The teen enters the code in DriveWatch on their iPhone and allows location "Always" and motion access, so they always know DriveWatch is on.',
          '',
          'PRIVATE BY DESIGN',
          'Drives and alerts are shared only inside your family. No ads, no selling data, no outside tracking. Anyone can delete their account in the app.',
          '',
          'DriveWatch can tell that the phone was used, not which app was opened.',
        ].join('\n'),
        marketingUrl: API,
        supportUrl: `${API}/support`,
        privacyPolicyUrl: `${API}/privacy`,
        screenshots: {
          APP_IPHONE_67: [1, 2, 3, 4, 5].map((n) => `store/apple/screenshot/en-US/APP_IPHONE_67/0${n}.png`),
        },
      },
    },
    release: {
      automaticRelease: true,
      phasedRelease: false,
    },
    review: {
      firstName: 'Doug',
      lastName: 'Weil',
      email: 'doug@webdesignnerd.com',
      phone: phone ?? '',
      demoRequired: false,
      notes: [
        'No username or password is needed. To see a family with sample drives and alerts:',
        '1. Open DriveWatch and tap "I have a code".',
        '2. Type any name and the code APPREVIEW, then tap Join. This code can be used any number of times.',
        '3. You are now a parent in "Sample Family". The home screen shows the driver Sam, alerts, and recent drives. Tap a drive to see its map. Tap Family (top right) for rules and codes.',
        '',
        'To try the driver side on a second iPhone: tap "I\'m a parent: start a family", tap Family, tap "Make a code for a driver", then enter that code on the second iPhone with "I have a code".',
        '',
        'Background location ("Always"): the app\'s core job is logging each drive on its own while the app is closed, so a parent is alerted when the driver\'s phone is used at speed. The driver joins only with a code a parent gives them and grants location and motion access themselves; parents are alerted if access is turned off. Motion data is used only to tell when the phone is being held during a drive.',
        '',
        'Account deletion: Family and rules > "Delete my account" (parents), or the bottom of the driver home screen.',
      ].join('\n'),
    },
  },
};
