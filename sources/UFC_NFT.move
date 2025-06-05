module UFC_NFT::ufc_nft {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::option;
    use std::vector;
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::object;
    use aptos_token_objects::collection;
    use aptos_token_objects::token::{Self, Token};

    /// The collection does not exist
    const ECOLLECTION_NOT_INITIALIZED: u64 = 1;
    /// The collection name is too long
    const ECOLLECTION_NAME_TOO_LONG: u64 = 6;
    /// The collection URI is too long
    const ECOLLECTION_URI_TOO_LONG: u64 = 7;
    /// The collection description is too long
    const ECOLLECTION_DESCRIPTION_TOO_LONG: u64 = 8;
    /// The token name is too long
    const ETOKEN_NAME_TOO_LONG: u64 = 9;
    /// The token URI is too long
    const ETOKEN_URI_TOO_LONG: u64 = 10;
    /// The token description is too long
    const ETOKEN_DESCRIPTION_TOO_LONG: u64 = 11;
    /// Batch size too large
    const EBATCH_SIZE_TOO_LARGE: u64 = 12;
    /// Empty batch not allowed
    const EEMPTY_BATCH: u64 = 13;
    /// Recipients and URIs vectors must have same length
    const EVECTOR_LENGTH_MISMATCH: u64 = 14;
    /// Collections and URIs vectors must have same length
    const ECOLLECTION_VECTOR_LENGTH_MISMATCH: u64 = 15;

    /// Maximum length for strings (increased for longer collection names)
    const MAX_STRING_LENGTH: u64 = 100;
    /// Maximum batch size for gas efficiency
    const MAX_BATCH_SIZE: u64 = 100;

    /// Token registry to track sequential IDs
    struct TokenRegistry has key {
        next_id: u64,
    }

    /// Simplified metadata for UFC NFTs with URI
    struct UFCTokenMetadata has key {
        id: u64,
        uri: String,
        token_address: address,
    }

    /// Event emitted when a collection is created
    struct CollectionCreatedEvent has drop, store {
        creator: address,
        collection_name: String,
        collection_uri: String,
        description: String,
        maximum: u64,
    }

    /// Event emitted when a token is minted
    struct TokenMintedEvent has drop, store {
        token_id: address,
        metadata_id: u64,
        creator: address,
        collection: String,
        name: String,
        uri: String,
        description: String,
    }

    /// Collection events
    struct CollectionEvents has key {
        collection_created_events: event::EventHandle<CollectionCreatedEvent>,
        token_minted_events: event::EventHandle<TokenMintedEvent>,
    }

    /// Initialize the module
    fun init_module(account: &signer) {
        // Initialize the collection events
        move_to(account, CollectionEvents {
            collection_created_events: account::new_event_handle(account),
            token_minted_events: account::new_event_handle(account),
        });

        // Initialize token registry with sequential counter
        move_to(account, TokenRegistry {
            next_id: 1,
        });
    }

    /// Get next sequential token ID and increment counter
    fun get_next_token_id(): u64 acquires TokenRegistry {
        let registry = borrow_global_mut<TokenRegistry>(@UFC_NFT);
        let current_id = registry.next_id;
        registry.next_id = registry.next_id + 1;
        current_id
    }

    /// Helper function to convert u64 to string
    fun to_string(value: u64): String {
        if (value == 0) {
            return string::utf8(b"0")
        };
        
        let buffer = vector::empty<u8>();
        while (value != 0) {
            let digit = ((value % 10) as u8) + 48; // ASCII offset for '0'
            vector::push_back(&mut buffer, digit);
            value = value / 10;
        };
        
        // Reverse the buffer
        vector::reverse(&mut buffer);
        string::utf8(buffer)
    }

    /// Create a new collection with optional URI mutability
    public entry fun create_collection(
        creator: &signer,
        name: String,
        uri: String,
        description: String,
        maximum: u64,
        mutable_uri: bool,
    ) acquires CollectionEvents {
        assert!(string::length(&name) <= MAX_STRING_LENGTH, error::invalid_argument(ECOLLECTION_NAME_TOO_LONG));
        assert!(string::length(&uri) <= MAX_STRING_LENGTH, error::invalid_argument(ECOLLECTION_URI_TOO_LONG));
        assert!(string::length(&description) <= MAX_STRING_LENGTH, error::invalid_argument(ECOLLECTION_DESCRIPTION_TOO_LONG));

        // Create collection based on whether we want unlimited supply for mutability support
        let _constructor_ref = if (mutable_uri) {
            // Use unlimited collection to support mutability
            collection::create_unlimited_collection(
                creator,
                description,
                name,
                option::none(),
                uri,
            )
        } else {
            // Use fixed collection for traditional behavior
            collection::create_fixed_collection(
                creator,
                description,
                maximum,
                name,
                option::none(),
                uri,
            )
        };

        // Emit collection created event
        let collection_events = borrow_global_mut<CollectionEvents>(@UFC_NFT);
        event::emit_event(
            &mut collection_events.collection_created_events,
            CollectionCreatedEvent {
                creator: signer::address_of(creator),
                collection_name: name,
                collection_uri: uri,
                description,
                maximum,
            },
        );
    }

    /// Batch mint multiple tokens with sequential IDs (most gas-efficient)
    public entry fun batch_mint_simple(
        creator: &signer,
        collections: vector<String>,
        uris: vector<String>,
    ) acquires CollectionEvents, TokenRegistry {
        // Validate batch parameters
        let batch_size = vector::length(&uris);
        let collections_len = vector::length(&collections);
        assert!(batch_size == collections_len, error::invalid_argument(ECOLLECTION_VECTOR_LENGTH_MISMATCH));
        assert!(batch_size <= MAX_BATCH_SIZE, error::invalid_argument(EBATCH_SIZE_TOO_LARGE));
        assert!(batch_size > 0, error::invalid_argument(EEMPTY_BATCH));
        
        let collection_events = borrow_global_mut<CollectionEvents>(@UFC_NFT);
        let creator_address = signer::address_of(creator);
        
        // Process each URI in the batch
        let i = 0;
        while (i < batch_size) {
            let uri = *vector::borrow(&uris, i);
            let collection = *vector::borrow(&collections, i);
            
            // Validate URI and collection name
            assert!(string::length(&uri) <= MAX_STRING_LENGTH, error::invalid_argument(ETOKEN_URI_TOO_LONG));
            assert!(string::length(&collection) <= MAX_STRING_LENGTH, error::invalid_argument(ECOLLECTION_NAME_TOO_LONG));
            
            // Get next sequential token ID
            let token_id = get_next_token_id();
            
            // Use token ID as name for simplicity
            let name = string::utf8(b"Token #");
            string::append(&mut name, to_string(token_id));

            let constructor_ref = token::create_named_token(
                creator,
                collection,
                string::utf8(b"Batch minted token"), // generic description
                name,
                option::none(),
                uri,
            );

            let token_object = object::object_from_constructor_ref<Token>(&constructor_ref);
            let token_address = object::object_address(&token_object);

            // Create simplified metadata and store it in token's resources
            let token_signer = object::generate_signer(&constructor_ref);
            let metadata = UFCTokenMetadata {
                id: token_id,
                uri,
                token_address,
            };
            move_to(&token_signer, metadata);

            // Emit token minted event
            event::emit_event(
                &mut collection_events.token_minted_events,
                TokenMintedEvent {
                    token_id: token_address,
                    metadata_id: token_id,
                    creator: creator_address,
                    collection,
                    name,
                    uri,
                    description: string::utf8(b"Batch minted token"),
                },
            );
            
            i = i + 1;
        };
    }

    /// Batch mint multiple tokens for different recipients
    public entry fun batch_mint_simple_for(
        creator: &signer,
        collections: vector<String>,
        recipients: vector<address>,
        uris: vector<String>,
    ) acquires CollectionEvents, TokenRegistry {
        // Validate batch parameters
        let batch_size = vector::length(&uris);
        let recipients_len = vector::length(&recipients);
        let collections_len = vector::length(&collections);
        assert!(batch_size == recipients_len, error::invalid_argument(EVECTOR_LENGTH_MISMATCH));
        assert!(batch_size == collections_len, error::invalid_argument(ECOLLECTION_VECTOR_LENGTH_MISMATCH));
        assert!(batch_size <= MAX_BATCH_SIZE, error::invalid_argument(EBATCH_SIZE_TOO_LARGE));
        assert!(batch_size > 0, error::invalid_argument(EEMPTY_BATCH));
        
        let collection_events = borrow_global_mut<CollectionEvents>(@UFC_NFT);
        let creator_address = signer::address_of(creator);
        
        // Process each token in the batch
        let i = 0;
        while (i < batch_size) {
            let uri = *vector::borrow(&uris, i);
            let recipient = *vector::borrow(&recipients, i);
            let collection = *vector::borrow(&collections, i);
            
            // Validate URI and collection name
            assert!(string::length(&uri) <= MAX_STRING_LENGTH, error::invalid_argument(ETOKEN_URI_TOO_LONG));
            assert!(string::length(&collection) <= MAX_STRING_LENGTH, error::invalid_argument(ECOLLECTION_NAME_TOO_LONG));
            
            // Get next sequential token ID
            let token_id = get_next_token_id();
            
            // Use token ID as name for simplicity
            let name = string::utf8(b"Token #");
            string::append(&mut name, to_string(token_id));

            let constructor_ref = token::create_named_token(
                creator,
                collection,
                string::utf8(b"Batch minted token"), // generic description
                name,
                option::none(),
                uri,
            );

            let token_object = object::object_from_constructor_ref<Token>(&constructor_ref);
            let token_address = object::object_address(&token_object);

            // Create simplified metadata and store it in token's resources
            let token_signer = object::generate_signer(&constructor_ref);
            let metadata = UFCTokenMetadata {
                id: token_id,
                uri,
                token_address,
            };
            move_to(&token_signer, metadata);
            
            // Transfer the token to the recipient
            object::transfer(creator, token_object, recipient);

            // Emit token minted event
            event::emit_event(
                &mut collection_events.token_minted_events,
                TokenMintedEvent {
                    token_id: token_address,
                    metadata_id: token_id,
                    creator: creator_address,
                    collection,
                    name,
                    uri,
                    description: string::utf8(b"Batch minted token"),
                },
            );
            
            i = i + 1;
        };
    }
} 