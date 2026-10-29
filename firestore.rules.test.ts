/**
 * Firestore Security Rules Verification Suite — "Dirty Dozen" + Treetop Safeguarding Payloads
 * Verifies that adversarial payloads across all 16 collections (including TreetopApplication,
 * PgCertNote, CanopyWorkshop, WorkshopRegistration, and WorkshopOverflowDetail)
 * return PERMISSION_DENIED while legitimate multi-player and admin-approved flows succeed.
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

export async function runDirtyDozenSecuritySuite(): Promise<void> {
  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: 'jays-job-club-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    const adminCtx = testEnv.authenticatedContext('admin_uid', {
      email: 'treetophomeschool@gmail.com',
      email_verified: true,
    });
    const spoofAdminCtx = testEnv.authenticatedContext('spoof_admin_uid', {
      email: 'treetophomeschool@gmail.com',
      email_verified: false,
    });
    const aliceCtx = testEnv.authenticatedContext('alice_uid', {
      email: 'alice@example.com',
      email_verified: true,
    });
    const bobCtx = testEnv.authenticatedContext('bob_uid', {
      email: 'bob@example.com',
      email_verified: true,
    });

    const adminDb = adminCtx.firestore();
    const spoofAdminDb = spoofAdminCtx.firestore();
    const aliceDb = aliceCtx.firestore();
    const bobDb = bobCtx.firestore();

    // Baseline valid atomic creation for Alice across core collections + pending Kiosk application
    const validBatch = writeBatch(aliceDb);
    validBatch.set(doc(aliceDb, 'publicProfiles', 'alice_uid'), {
      uid: 'alice_uid',
      username: 'Alice Lanternmaker',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validBatch.set(doc(aliceDb, 'canopyStudios', 'alice_uid'), {
      uid: 'alice_uid',
      studioName: 'Alice Joinery Loft',
      tradeFocus: 'Metalwork & Lanterns',
      floorStyle: 'interlocking_oak',
      trimAccent: 'warm_brass',
      safetyGateClosed: true,
      furnishedItems: ['brass_hanging_lantern'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validBatch.set(doc(aliceDb, 'treeProgress', 'alice_uid'), {
      uid: 'alice_uid',
      tryingTokens: 2,
      gatheringTokens: 3,
      treehouseTokens: 6,
      ownedFurnishings: ['brass_hanging_lantern'],
      sharesCompleted: 1,
      welcomeCheckedIn: true,
      dailyStreak: 4,
      bestStreak: 7,
      lastStreakDate: '2026-10-25',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validBatch.set(doc(aliceDb, 'toolsOfTrade', 'tool_private_1'), {
      ownerId: 'alice_uid',
      username: 'Alice Lanternmaker',
      toolName: 'Cedar Smoothing Plane',
      tradeCategory: 'Woodcraft & Joinery',
      visualKind: 'joinery_plane',
      showAndTellStory:
        'Hand-tuned smoothing plane used to chamfer safe rounded handrails.',
      isSharedShowAndTell: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validBatch.set(doc(aliceDb, 'storeListings', 'listing_lantern_1'), {
      sellerId: 'alice_uid',
      sellerName: 'Alice Lanternmaker',
      itemKind: 'brass_hanging_lantern',
      title: 'Hammered Brass Rafter Lantern',
      craftNote: 'Warm spun brass shade with frosted amber glass.',
      priceTokens: 4,
      status: 'available',
      buyerId: '',
      proceedsClaimed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validBatch.set(doc(aliceDb, 'serviceProviders', 'alice_uid'), {
      providerId: 'alice_uid',
      displayName: 'Alice Joinery Mentor',
      providerRole: 'Neurobiologically-Aware Skills & Trade Trainer',
      specialtySummary:
        'Paced joinery and brass lantern fabrication structured around monotropic deep focus.',
      neuroAccommodations:
        'Low-glare bench lighting, written-first step checklists, zero forced speed.',
      sessionMode: 'Live Collab Workbench',
      availabilityStatus: 'available',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validBatch.set(doc(aliceDb, 'artisanItems', 'item_cedar_1'), {
      makerId: 'alice_uid',
      makerName: 'Alice Lanternmaker',
      title: 'Dovetail Aromatic Cedar Tool Box',
      category: 'Woodcraft & Joinery',
      materialsAndDimensions: 'Pacific red cedar & brass latch · 24cm x 15cm x 11cm',
      story: 'Hand-planed corner dovetails finished in natural beeswax.',
      priceCents: 4800,
      stockCount: 5,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validBatch.set(doc(aliceDb, 'journalEntries', 'journal_valid_1'), {
      uid: 'alice_uid',
      title: 'Humane Pollinator Box Dimensions',
      content: 'Drafted untreated cedar planter dimensions safe for bees.',
      entryType: 'Working Paper & Notes',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validBatch.set(doc(aliceDb, 'treetopApplications', 'alice_uid'), {
      applicantId: 'alice_uid',
      displayName: 'Alice Lanternmaker',
      specialInterestJourney:
        'Building low-glare brass lanterns and hand-planed agarwood joinery boxes at a steady pace.',
      preferredTradeTrack: 'Metalwork & Lanterns',
      supervisionContext: 'Competent Adult (18+)',
      status: 'pending',
      treetopTokenGranted: false,
      tokenCode: '',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(validBatch.commit());

    // 1. Self-Granted Treetop Token Escalation on Create/Update (MUST FAIL)
    await assertFails(
      setDoc(doc(bobDb, 'treetopApplications', 'bob_uid'), {
        applicantId: 'bob_uid',
        displayName: 'Bob Weaver',
        specialInterestJourney:
          'Attempting to self-issue an approved Treetop Token without admin review.',
        preferredTradeTrack: 'Textiles & Weaving',
        supervisionContext: 'Competent Adult (18+)',
        status: 'approved',
        treetopTokenGranted: true,
        tokenCode: 'TTK-BOB-999',
        adminNote: 'Self-approved',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 2. Unverified Admin Email Spoof Attempting to Approve Alice's Treetop Token (MUST FAIL)
    await assertFails(
      updateDoc(doc(spoofAdminDb, 'treetopApplications', 'alice_uid'), {
        status: 'approved',
        treetopTokenGranted: true,
        tokenCode: 'TTK-SPOOF-01',
        adminNote: 'Spoofed approval',
        updatedAt: serverTimestamp(),
      })
    );

    // 3. Unapproved Applicant Attempting to Enter Canopy Workshop or Post PG Cert Note (MUST FAIL)
    await assertFails(
      setDoc(doc(aliceDb, 'pgCertNotes', 'note_1'), {
        authorId: 'alice_uid',
        studentHandle: 'PG Cert Trainee',
        moduleTheme: 'Monotropism & Special Interest Flow',
        title: 'Deep Focus Tunnels in Workshop Learning',
        studyReflection:
          'Reflecting on Murray, Lesser, and Lawson regarding monotropic attention flow in craft settings.',
        practiceTakeaway: 'Allow unhurried transitions between workshop tasks.',
        visibility: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Legitimate Admin Approves Alice's Treetop Token
    await assertSucceeds(
      updateDoc(doc(adminDb, 'treetopApplications', 'alice_uid'), {
        status: 'approved',
        treetopTokenGranted: true,
        tokenCode: 'TTK-ALICE-2026',
        adminNote: 'Welcome to the 33m Canopy workshops!',
        updatedAt: serverTimestamp(),
      })
    );

    // Admin schedules a 33m Canopy Workshop + Protected Social Overflow Details
    const workshopBatch = writeBatch(adminDb);
    workshopBatch.set(doc(adminDb, 'canopyWorkshops', 'ws_joinery_1'), {
      hostId: 'admin_uid',
      hostName: 'Treetop Mentor',
      title: 'Agarwood & Cedar Dovetail Trade Bench',
      tradeCategory: 'Woodcraft & Joinery',
      specialInterestFocus:
        'Turning quiet timber geometry focus into practical cabinetmaking joinery.',
      rotaSlotLabel: 'Tuesdays · 14:00–15:15 UK',
      sensoryPacingNote: 'Camera optional, written steps provided, zero forced speed.',
      overflowPlatform: 'Zoom Supervised Meet-Up',
      overflowSummary:
        'Optional moderated Zoom bench check-in with parent, carer, or competent adult approval.',
      maxParticipants: 10,
      status: 'scheduled',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    workshopBatch.set(
      doc(adminDb, 'canopyWorkshops', 'ws_joinery_1', 'overflowAccess', 'details'),
      {
        workshopId: 'ws_joinery_1',
        hostId: 'admin_uid',
        platformLabel: 'Zoom Supervised Meet-Up',
        joinInstructionsAndHandle:
          'Moderated Room Reference: JJC-CANOPY-TUE (Supervised waiting room enabled)',
        moderationRules:
          'No private direct messages; parent, carer, or competent adult supporter welcome.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    await assertSucceeds(workshopBatch.commit());

    // 4. Approved Token Holder Reading Overflow Details WITHOUT Adult Approval Registration (MUST FAIL)
    await assertFails(
      getDoc(
        doc(aliceDb, 'canopyWorkshops', 'ws_joinery_1', 'overflowAccess', 'details')
      )
    );

    // 5. Requesting Social Overflow with adultApprovalConfirmed: false (MUST FAIL)
    await assertFails(
      setDoc(
        doc(aliceDb, 'canopyWorkshops', 'ws_joinery_1', 'registrations', 'alice_uid'),
        {
          workshopId: 'ws_joinery_1',
          attendeeId: 'alice_uid',
          attendeeName: 'Alice Lanternmaker',
          wantsSocialOverflow: true,
          adultApprovalType: 'Parent Approval Confirmed',
          adultApprovalConfirmed: false,
          appropriatenessConfirmed: true,
          safeguardingNote: 'Missing confirmation boolean',
          status: 'registered',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    );

    // Legitimate Registration WITH Confirmed Competent Adult / Parent / Carer Approval Unlocks Overflow
    await assertSucceeds(
      setDoc(
        doc(aliceDb, 'canopyWorkshops', 'ws_joinery_1', 'registrations', 'alice_uid'),
        {
          workshopId: 'ws_joinery_1',
          attendeeId: 'alice_uid',
          attendeeName: 'Alice Lanternmaker',
          wantsSocialOverflow: true,
          adultApprovalType: 'Parent Approval Confirmed',
          adultApprovalConfirmed: true,
          appropriatenessConfirmed: true,
          safeguardingNote: 'Parent reviewed moderated Zoom craft group rules.',
          status: 'registered',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    );
    await assertSucceeds(
      getDoc(
        doc(aliceDb, 'canopyWorkshops', 'ws_joinery_1', 'overflowAccess', 'details')
      )
    );

    // 6. Cross-User Private Journal & Private Tool Read (MUST FAIL)
    await assertFails(getDoc(doc(bobDb, 'journalEntries', 'journal_valid_1')));
    await assertFails(getDoc(doc(bobDb, 'toolsOfTrade', 'tool_private_1')));

    // 7. Shadow Field Injection on ArtisanItem Create (MUST FAIL)
    await assertFails(
      setDoc(doc(aliceDb, 'artisanItems', 'item_shadow_1'), {
        makerId: 'alice_uid',
        makerName: 'Alice Lanternmaker',
        title: 'Hand-Loomed Runner',
        category: 'Textiles & Weaving',
        materialsAndDimensions: '120cm x 34cm natural wool',
        story: 'Woven on a hardwood boat-shuttle loom.',
        priceCents: 4200,
        stockCount: 3,
        status: 'active',
        featured: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 8. Invalid Streak Date Format on TreeProgress Update (MUST FAIL)
    await assertFails(
      updateDoc(doc(aliceDb, 'treeProgress', 'alice_uid'), {
        lastStreakDate: '25-10-2026-invalid',
        updatedAt: serverTimestamp(),
      })
    );

    // 9. Self-Purchase on StoreListing (MUST FAIL)
    await assertFails(
      updateDoc(doc(aliceDb, 'storeListings', 'listing_lantern_1'), {
        status: 'sold',
        buyerId: 'alice_uid',
        updatedAt: serverTimestamp(),
      })
    );

    // 10. Out-of-bounds Price Poisoning on ArtisanItem (MUST FAIL)
    await assertFails(
      updateDoc(doc(aliceDb, 'artisanItems', 'item_cedar_1'), {
        priceCents: 999999,
        updatedAt: serverTimestamp(),
      })
    );

    // 11. ID Poisoning Attack (MUST FAIL)
    await assertFails(
      setDoc(doc(aliceDb, 'artisanItems', 'bad$id!spaces'), {
        makerId: 'alice_uid',
        makerName: 'Alice Lanternmaker',
        title: 'Valid Title',
        category: 'Woodcraft & Joinery',
        materialsAndDimensions: 'Red cedar 20x10cm',
        story: 'Carefully crafted dovetail box.',
        priceCents: 2500,
        stockCount: 2,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 12. Immutable createdAt Mutation & Blanket List Scrape (MUST FAIL)
    await assertFails(
      updateDoc(doc(aliceDb, 'journalEntries', 'journal_valid_1'), {
        title: 'Backdated Note',
        createdAt: Timestamp.fromMillis(1000),
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(getDocs(collection(bobDb, 'serviceProviders')));
    await assertSucceeds(
      getDocs(
        query(
          collection(bobDb, 'serviceProviders'),
          where('availabilityStatus', '==', 'available')
        )
      )
    );

    // 13. Entry Kiosk Personal Special-Interest-to-Job Dashboard (/interestPathways)
    await assertSucceeds(
      setDoc(doc(aliceDb, 'interestPathways', 'pathway_alice_1'), {
        uid: 'alice_uid',
        entrantHandle: 'Alice Lanternmaker',
        specialInterest: 'Vintage brass clockwork gears and lantern optics',
        potentialJobRole: 'Heritage Horology & Architectural Lighting Technician',
        tradeTrack: 'Metalwork & Lanterns',
        comfortableNextStep:
          'Practice cleaning and re-assembling a brass lantern hinge at my own pace.',
        readinessStage: 'Exploring Curiosity',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Cross-user read & unfiltered list scrape on /interestPathways MUST FAIL
    await assertFails(
      getDoc(doc(bobDb, 'interestPathways', 'pathway_alice_1'))
    );
    await assertFails(getDocs(collection(bobDb, 'interestPathways')));

    // Owner filtered list & readiness stage progression MUST SUCCEED
    await assertSucceeds(
      getDocs(
        query(
          collection(aliceDb, 'interestPathways'),
          where('uid', '==', 'alice_uid')
        )
      )
    );
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'interestPathways', 'pathway_alice_1'), {
        readinessStage: 'Practicing Craft',
        updatedAt: serverTimestamp(),
      })
    );

    // Shadow PII field injection on /interestPathways MUST FAIL
    await assertFails(
      setDoc(doc(aliceDb, 'interestPathways', 'pathway_shadow_1'), {
        uid: 'alice_uid',
        entrantHandle: 'Alice Lanternmaker',
        specialInterest: 'Timber joinery geometry',
        potentialJobRole: 'Bespoke Cabinetmaker',
        tradeTrack: 'Woodcraft & Joinery',
        comfortableNextStep: 'Try one hand-cut dovetail joint.',
        readinessStage: 'Exploring Curiosity',
        email: 'alice@example.com',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 14. Agarwood Essential Oil Tools & Labelled Bottle Listings (/toolsOfTrade & /craftedBottles)
    await assertSucceeds(
      setDoc(doc(aliceDb, 'toolsOfTrade', 'tool_agarwood_still_1'), {
        ownerId: 'alice_uid',
        username: 'Alice Lanternmaker',
        toolName: 'Copper Agarwood Bark Hydro-Still',
        tradeCategory: 'Botanical & Essential Oils',
        visualKind: 'agarwood_alembic_still',
        showAndTellStory:
          'Hand-hammered copper hydro-distillation still for extracting warm essential oil from sustainably gathered Agarwood tree bark.',
        isSharedShowAndTell: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await assertSucceeds(
      setDoc(doc(aliceDb, 'craftedBottles', 'bottle_agarwood_1'), {
        makerId: 'alice_uid',
        makerName: 'Alice Lanternmaker',
        productTitle: 'Pure Sanctuary Agarwood Bark Oil',
        labelHeadline: 'PURE AGARWOOD BARK OIL',
        labelBatchNote: 'Steam-Distilled Aquilaria Bark · Batch #04 · 10ml',
        barkOriginAndProcess:
          'Hydro-distilled in copper alembic still from fallen resinous Agarwood bark, filtered, bottled in amber glass, and high-contrast labelled.',
        bottleSizeMl: 10,
        saleVenue: 'both',
        pricePence: 1800,
        priceTokens: 4,
        stockCount: 6,
        status: 'on_sale',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Unfiltered list scrape on /craftedBottles MUST FAIL; filtered on_sale list MUST SUCCEED
    await assertFails(getDocs(collection(bobDb, 'craftedBottles')));
    await assertSucceeds(
      getDocs(
        query(
          collection(bobDb, 'craftedBottles'),
          where('status', '==', 'on_sale')
        )
      )
    );

    // Identity spoofing or invalid bottleSizeMl on /craftedBottles MUST FAIL
    await assertFails(
      setDoc(doc(bobDb, 'craftedBottles', 'bottle_spoof_1'), {
        makerId: 'alice_uid',
        makerName: 'Alice Lanternmaker',
        productTitle: 'Spoofed Bottle',
        labelHeadline: 'SPOOFED OIL',
        labelBatchNote: 'Fake Batch',
        barkOriginAndProcess: 'Spoofed makerId test payload.',
        bottleSizeMl: 10,
        saleVenue: 'welcome_area',
        pricePence: 1500,
        priceTokens: 3,
        stockCount: 2,
        status: 'on_sale',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Terminal 'archived' state lock on /craftedBottles MUST FAIL for non-admin updates
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'craftedBottles', 'bottle_agarwood_1'), {
        status: 'archived',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'craftedBottles', 'bottle_agarwood_1'), {
        priceTokens: 6,
        updatedAt: serverTimestamp(),
      })
    );

    // Collection 19: /canopyPaypalItems — Valid create, filtered list, buyer stock decrement, and terminal archive lock
    await assertSucceeds(
      setDoc(doc(aliceDb, 'canopyPaypalItems', 'cp_alice_oil_1'), {
        sellerId: 'alice_uid',
        sellerName: 'Alice Lanternmaker',
        title: 'Small-Batch Agarwood Bark Essential Oil (15ml)',
        tradeCategory: 'Botanical & Essential Oils',
        materialsSpec: '15ml amber glass dropper vial · Cultivated Agarwood bark',
        craftStory:
          'Hydro-distilled from resinous Agarwood bark shavings at a calm unhurried pace for the 33m Canopy Store.',
        sellerBenchTag: 'Canopy Still #05',
        priceCents: 2800,
        stockCount: 4,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Unfiltered list scrape on /canopyPaypalItems MUST FAIL; active query MUST SUCCEED
    await assertFails(getDocs(collection(bobDb, 'canopyPaypalItems')));
    await assertSucceeds(
      getDocs(
        query(
          collection(bobDb, 'canopyPaypalItems'),
          where('status', '==', 'active')
        )
      )
    );

    // Buyer (Bob) can decrement stockCount, CANNOT inflate stockCount or mutate priceCents
    await assertFails(
      updateDoc(doc(bobDb, 'canopyPaypalItems', 'cp_alice_oil_1'), {
        stockCount: 50,
        status: 'active',
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      updateDoc(doc(bobDb, 'canopyPaypalItems', 'cp_alice_oil_1'), {
        stockCount: 3,
        status: 'active',
        updatedAt: serverTimestamp(),
      })
    );

    // Seller archives Canopy PayPal item; subsequent non-admin update MUST FAIL
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'canopyPaypalItems', 'cp_alice_oil_1'), {
        stockCount: 0,
        status: 'archived',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'canopyPaypalItems', 'cp_alice_oil_1'), {
        priceCents: 3500,
        updatedAt: serverTimestamp(),
      })
    );

    // Collection 20: /shoeCharacters — Owner-isolated Wellington Boots & Work Shoes selection
    await assertSucceeds(
      setDoc(doc(aliceDb, 'shoeCharacters', 'alice_uid'), {
        uid: 'alice_uid',
        shoeKind: 'wellington_boots',
        colorway: 'forest_welly_green',
        characterNickname: 'Woodland Wellies',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // Cross-user read or shadow-field write on /shoeCharacters MUST FAIL
    await assertFails(getDoc(doc(bobDb, 'shoeCharacters', 'alice_uid')));
    await assertFails(
      setDoc(doc(bobDb, 'shoeCharacters', 'bob_uid'), {
        uid: 'bob_uid',
        shoeKind: 'wellington_boots',
        colorway: 'forest_welly_green',
        characterNickname: 'Bob Wellies',
        email: 'leak@example.com',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Collection 21: /chillPodOccupancy — Strict 1-Per-Person Mezzanine Chill Pods & Sensory Controls
    // Invalid pod ID (pod_99) MUST FAIL
    await assertFails(
      setDoc(doc(aliceDb, 'chillPodOccupancy', 'pod_99'), {
        podId: 'pod_99',
        podLabel: 'Rogue Pod',
        occupantId: 'alice_uid',
        occupantName: 'Alice Lanternmaker',
        occupancyStatus: 'occupied',
        fanEnabled: true,
        heaterEnabled: false,
        lightsOffCalm: false,
        flotationEnabled: false,
        quiltType: 'none',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Alice legitimately claims Pod 1 (occupied)
    await assertSucceeds(
      setDoc(doc(aliceDb, 'chillPodOccupancy', 'pod_1'), {
        podId: 'pod_1',
        podLabel: 'Cedar Pod 01 · West Eaves',
        occupantId: 'alice_uid',
        occupantName: 'Alice Lanternmaker',
        occupancyStatus: 'occupied',
        fanEnabled: true,
        heaterEnabled: false,
        lightsOffCalm: true,
        flotationEnabled: false,
        quiltType: 'vegan',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Bob attempting to intrude or flip switches in Alice's occupied Pod 1 MUST FAIL (1-per-person rule)
    await assertFails(
      updateDoc(doc(bobDb, 'chillPodOccupancy', 'pod_1'), {
        occupantId: 'bob_uid',
        occupantName: 'Bob Weaver',
        occupancyStatus: 'occupied',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(bobDb, 'chillPodOccupancy', 'pod_1'), {
        heaterEnabled: true,
        updatedAt: serverTimestamp(),
      })
    );

    // Alice toggles Flotation Water + Natural Duck Feather Heavy Quilt inside her own pod (MUST SUCCEED)
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'chillPodOccupancy', 'pod_1'), {
        fanEnabled: false,
        heaterEnabled: true,
        flotationEnabled: true,
        quiltType: 'natural_duck_feather',
        updatedAt: serverTimestamp(),
      })
    );

    // Alice steps out / vacates Pod 1 (resets sensory state); Bob can now legitimately enter Pod 1
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'chillPodOccupancy', 'pod_1'), {
        occupantId: '',
        occupantName: '',
        occupancyStatus: 'vacant',
        fanEnabled: false,
        heaterEnabled: false,
        lightsOffCalm: false,
        flotationEnabled: false,
        quiltType: 'none',
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      updateDoc(doc(bobDb, 'chillPodOccupancy', 'pod_1'), {
        occupantId: 'bob_uid',
        occupantName: 'Bob Weaver',
        occupancyStatus: 'occupied',
        fanEnabled: true,
        heaterEnabled: false,
        lightsOffCalm: false,
        flotationEnabled: false,
        quiltType: 'vegan',
        updatedAt: serverTimestamp(),
      })
    );

    // Collection 22 & Subcollection 23: /jobCentreVacancies & /collaborators
    // Signed-in getDoc existence check on unmaterialized curated Job Centre card MUST SUCCEED
    await assertSucceeds(
      getDoc(doc(bobDb, 'jobCentreVacancies', 'jc_real_jays_beta_researcher'))
    );
    // Own non-existent collaborator pledge check MUST SUCCEED; cross-user non-existent probe MUST FAIL
    await assertSucceeds(
      getDoc(
        doc(
          bobDb,
          'jobCentreVacancies',
          'jc_real_jays_beta_researcher',
          'collaborators',
          'bob_uid'
        )
      )
    );
    await assertFails(
      getDoc(
        doc(
          bobDb,
          'jobCentreVacancies',
          'jc_real_jays_beta_researcher',
          'collaborators',
          'alice_uid'
        )
      )
    );

    // Real Notice JC-001 (Beta User Researcher — Jay's Job Centre) & JC-002 (Drazella Sprinkes) MUST SUCCEED
    await assertSucceeds(
      setDoc(
        doc(aliceDb, 'jobCentreVacancies', 'jc_real_jays_beta_researcher'),
        {
          referenceCode: 'JC-001',
          jobTitle: "Beta User Researcher — Jay's Job Centre",
          tradeCategory: 'Digital & Systems Craft',
          locationZone: '0m Courtyard Workbench',
          pacingStyle: 'Flexible Drop-In',
          cardSummary:
            "Real Beta User Researcher notice for Jay's Job Centre: test the 0m Job Centre cards, Agarwood Lift paces, and 33m Safe Chill Pods at your own pace.",
          keySteps:
            '1. Pick a Job Slip at 0m Courtyard · 2. Test Lift paces & 33m Chill Pods · 3. Log 2-minute UX Beta note.',
          collaborationMode: 'Open Team-Up & Skill Swap',
          collaborationOpen: true,
          rewardTokens: 5,
          creatorId: 'alice_uid',
          creatorName: "Jay's Job Centre",
          status: 'open',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    );
    await assertSucceeds(
      setDoc(
        doc(
          aliceDb,
          'jobCentreVacancies',
          'jc_real_drazella_sprinkes_publishing'
        ),
        {
          referenceCode: 'JC-002',
          jobTitle:
            'Youth Development Publishing: Easy Read Neurobiological Books (Digital Art)',
          tradeCategory: 'Digital & Systems Craft',
          locationZone: '33m Mezzanine Library & Refreshments',
          pacingStyle: 'Paired Quiet Bench',
          cardSummary:
            'Drazella Sprinkes advert for Youth Development Publishing: co-create neurobiological books in Easy Read for visually impaired readers, seniors, and speakers of other languages using digital art.',
          keySteps:
            '1. Draft 1-idea-per-line Easy Read brain guides · 2. Illustrate high-contrast digital art · 3. Check clarity for low-vision, senior & multilingual readers.',
          collaborationMode: 'Open Team-Up & Skill Swap',
          collaborationOpen: true,
          rewardTokens: 5,
          creatorId: 'alice_uid',
          creatorName: 'Drazella Sprinkes',
          status: 'open',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    );

    await assertSucceeds(
      setDoc(doc(aliceDb, 'jobCentreVacancies', 'jc_vacancy_1'), {
        referenceCode: 'JC-101',
        jobTitle: 'Cedar Birdbox Joinery & Sanding Crew',
        tradeCategory: 'Woodcraft & Joinery',
        locationZone: '0m Courtyard Workbench',
        pacingStyle: 'Small Collab Crew (2-4)',
        cardSummary:
          'Prepare and sand untreated cedar panels for community woodland nesting boxes at an unhurried pace.',
        keySteps:
          '1. Check timber grain · 2. Sand edges smooth · 3. Peg brass hinges with buddy',
        collaborationMode: 'Open Team-Up & Skill Swap',
        collaborationOpen: true,
        rewardTokens: 3,
        creatorId: 'alice_uid',
        creatorName: 'Alice Lanternmaker',
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Unfiltered list scrape on /jobCentreVacancies MUST FAIL; status filter MUST SUCCEED
    await assertFails(getDocs(collection(bobDb, 'jobCentreVacancies')));
    await assertSucceeds(
      getDocs(
        query(
          collection(bobDb, 'jobCentreVacancies'),
          where('status', '==', 'open')
        )
      )
    );

    // Orphaned collaborator creation on non-existent vacancy MUST FAIL (Pillar 1 Master Gate)
    await assertFails(
      setDoc(
        doc(bobDb, 'jobCentreVacancies', 'nonexistent_jc', 'collaborators', 'bob_uid'),
        {
          vacancyId: 'nonexistent_jc',
          memberId: 'bob_uid',
          memberName: 'Bob Weaver',
          collabRole: 'Co-Maker Buddy',
          pledgeNote: 'Happy to help sand edges.',
          preferredStation: 'Ground Courtyard',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    );

    // Legitimate collaborator pledge by Bob on Alice's open Job Centre card MUST SUCCEED
    await assertSucceeds(
      setDoc(
        doc(bobDb, 'jobCentreVacancies', 'jc_vacancy_1', 'collaborators', 'bob_uid'),
        {
          vacancyId: 'jc_vacancy_1',
          memberId: 'bob_uid',
          memberName: 'Bob Weaver',
          collabRole: 'Co-Maker Buddy',
          pledgeNote: 'Joining to help chamfer edges and pair up on assembly.',
          preferredStation: 'Ground Courtyard',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    );

    // Archiving Job Centre card locks further non-admin edits (Terminal state lock)
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'jobCentreVacancies', 'jc_vacancy_1'), {
        status: 'archived',
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'jobCentreVacancies', 'jc_vacancy_1'), {
        rewardTokens: 10,
        updatedAt: serverTimestamp(),
      })
    );

    // Collection 24: /uxBetaFeedback — Verified Beta Tester UX Feedback & Owner/Admin Isolation
    await assertSucceeds(
      setDoc(doc(bobDb, 'uxBetaFeedback', 'fb_bob_1'), {
        authorId: 'bob_uid',
        testerHandle: 'Bob Weaver',
        focusArea: 'Private Sensory Chill Pods',
        easeScore: 5,
        workedWell:
          'Loved stepping into Pod 1 and switching on the fan and vegan weighted quilt.',
        improvementIdea: 'Keep the station jump buttons visible at the bottom.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // Cross-user read on UX Beta Feedback MUST FAIL; Admin read MUST SUCCEED
    await assertFails(getDoc(doc(aliceDb, 'uxBetaFeedback', 'fb_bob_1')));
    await assertSucceeds(getDoc(doc(adminDb, 'uxBetaFeedback', 'fb_bob_1')));

    // Collection 25: /dailyHabitTrackers/{userId} — Owner/Admin Isolated Daily Mastery Habit Tracker
    await assertSucceeds(
      setDoc(doc(aliceDb, 'dailyHabitTrackers', 'alice_uid'), {
        uid: 'alice_uid',
        activeDate: '2026-10-29',
        energyPoints: 35,
        lifetimeEnergyEarned: 35,
        totalMilestonesLogged: 2,
        dailyStreak: 3,
        bestStreak: 5,
        completedIdsToday: ['focus_15m', 'community_outreach'],
        customHabitLabels: ['15m joinery sketch'],
        lastMilestoneLabel: 'Community outreach',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Cross-user read on Alice's DailyHabitTracker by Bob MUST FAIL; Admin read MUST SUCCEED
    await assertFails(getDoc(doc(bobDb, 'dailyHabitTrackers', 'alice_uid')));
    await assertSucceeds(getDoc(doc(adminDb, 'dailyHabitTrackers', 'alice_uid')));

    // Shadow PII field or unknown habit ID injection MUST FAIL
    await assertFails(
      setDoc(doc(bobDb, 'dailyHabitTrackers', 'bob_uid'), {
        uid: 'bob_uid',
        activeDate: '2026-10-29',
        energyPoints: 15,
        lifetimeEnergyEarned: 15,
        totalMilestonesLogged: 1,
        dailyStreak: 1,
        bestStreak: 1,
        completedIdsToday: ['hacked_habit_id'],
        customHabitLabels: [],
        lastMilestoneLabel: '15 mins focus',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'dailyHabitTrackers', 'alice_uid'), {
        energyPoints: 50,
        lifetimeEnergyEarned: 50,
        email: 'leak@example.com',
        updatedAt: serverTimestamp(),
      })
    );

    // Legitimate habit update & energy spend by owner MUST SUCCEED
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'dailyHabitTrackers', 'alice_uid'), {
        energyPoints: 10,
        lifetimeEnergyEarned: 35,
        updatedAt: serverTimestamp(),
      })
    );

    // JC-003 Bank of Treetop Exchequer (Unpaid Volunteer Role) Job Card materialization MUST SUCCEED
    await assertSucceeds(
      setDoc(
        doc(aliceDb, 'jobCentreVacancies', 'jc_real_bank_of_treetop_exchequer'),
        {
          referenceCode: 'JC-003',
          jobTitle: 'Exchequer (Unpaid Volunteer Role) — Bank of Treetop',
          tradeCategory: 'Digital & Systems Craft',
          locationZone: '33m Canopy Workshop',
          pacingStyle: 'Flexible Drop-In',
          cardSummary:
            "Unpaid volunteer role open to any member of Jay's Job Club at the Bank of Treetop (not a real bank; symbolic club tokens only).",
          keySteps:
            '1. Confirm Not-a-Real-Bank disclaimer · 2. Guide peers on Special-Interest Stock Pots · 3. Tally symbolic club tokens.',
          collaborationMode: 'Open Team-Up & Skill Swap',
          collaborationOpen: true,
          rewardTokens: 5,
          creatorId: 'alice_uid',
          creatorName: 'Bank of Treetop',
          status: 'open',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    );

    // Collection 26: /bankOfTreetopLedgers/{userId} — Symbolic Stock Savings Pot (NOT a real bank)
    // Creating without accepting the Not-a-Real-Bank disclaimer MUST FAIL
    await assertFails(
      setDoc(doc(aliceDb, 'bankOfTreetopLedgers', 'alice_uid'), {
        uid: 'alice_uid',
        selectedBundleId: 'stock_drazella_publishing',
        customInterestGoal: '',
        savedUnits: 2,
        lifetimeUnitsSaved: 2,
        bundlesRequisitioned: 0,
        exchequerChecksLogged: 0,
        disclaimerAccepted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Legitimate owner ledger with disclaimerAccepted: true MUST SUCCEED
    await assertSucceeds(
      setDoc(doc(aliceDb, 'bankOfTreetopLedgers', 'alice_uid'), {
        uid: 'alice_uid',
        selectedBundleId: 'stock_drazella_publishing',
        customInterestGoal: 'High-contrast Easy Read digital art cardstock',
        savedUnits: 4,
        lifetimeUnitsSaved: 4,
        bundlesRequisitioned: 0,
        exchequerChecksLogged: 1,
        disclaimerAccepted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Cross-user read/write by Bob MUST FAIL; Admin read MUST SUCCEED
    await assertFails(getDoc(doc(bobDb, 'bankOfTreetopLedgers', 'alice_uid')));
    await assertSucceeds(
      getDoc(doc(adminDb, 'bankOfTreetopLedgers', 'alice_uid'))
    );
  } finally {
    await testEnv.cleanup();
  }
}

