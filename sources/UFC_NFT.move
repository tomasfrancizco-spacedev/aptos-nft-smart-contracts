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
    /// Token ID already exists
    const ETOKEN_ID_ALREADY_EXISTS: u64 = 12;

    /// Maximum length for strings
    const MAX_STRING_LENGTH: u64 = 128;

    /// Mapping of token IDs to track which ones have been used
    struct TokenRegistry has key {
        used_ids: vector<u64>,
    }

    /// Metadata for UFC NFTs
    struct UFCTokenMetadata has key {
        id: u64,
        fighter_name: String,
        weight_class: String,
        record: String,
        ranking: u64,
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
        fighter_name: String,
        weight_class: String,
        record: String,
        ranking: u64,
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

        // Initialize token registry
        move_to(account, TokenRegistry {
            used_ids: vector[],
        });
    }

    /// Check if a token ID is already used
    fun is_token_id_used(token_id: u64): bool acquires TokenRegistry {
        let registry = borrow_global<TokenRegistry>(@UFC_NFT);
        let i = 0;
        let len = vector::length(&registry.used_ids);
        
        while (i < len) {
            if (*vector::borrow(&registry.used_ids, i) == token_id) {
                return true
            };
            i = i + 1;
        };
        
        false
    }

    /// Register a new token ID as used
    fun register_token_id(token_id: u64) acquires TokenRegistry {
        let registry = borrow_global_mut<TokenRegistry>(@UFC_NFT);
        vector::push_back(&mut registry.used_ids, token_id);
    }

    /// Create a new collection
    public entry fun create_collection(
        creator: &signer,
        name: String,
        uri: String,
        description: String,
        maximum: u64,
    ) acquires CollectionEvents {
        assert!(string::length(&name) <= MAX_STRING_LENGTH, error::invalid_argument(ECOLLECTION_NAME_TOO_LONG));
        assert!(string::length(&uri) <= MAX_STRING_LENGTH, error::invalid_argument(ECOLLECTION_URI_TOO_LONG));
        assert!(string::length(&description) <= MAX_STRING_LENGTH, error::invalid_argument(ECOLLECTION_DESCRIPTION_TOO_LONG));

        let _constructor_ref = collection::create_fixed_collection(
            creator,
            description,
            maximum,
            name,
            option::none(),
            uri,
        );

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

    /// Mint a new token with a custom ID
    public entry fun mint_token(
        creator: &signer,
        token_id: u64,
        collection: String,
        name: String,
        uri: String,
        description: String,
        fighter_name: String,
        weight_class: String,
        record: String,
        ranking: u64,
    ) acquires CollectionEvents, TokenRegistry {
        assert!(string::length(&name) <= MAX_STRING_LENGTH, error::invalid_argument(ETOKEN_NAME_TOO_LONG));
        assert!(string::length(&uri) <= MAX_STRING_LENGTH, error::invalid_argument(ETOKEN_URI_TOO_LONG));
        assert!(string::length(&description) <= MAX_STRING_LENGTH, error::invalid_argument(ETOKEN_DESCRIPTION_TOO_LONG));
        
        // Check if token ID is already used
        assert!(!is_token_id_used(token_id), error::already_exists(ETOKEN_ID_ALREADY_EXISTS));

        let constructor_ref = token::create_named_token(
            creator,
            collection,
            description,
            name,
            option::none(),
            uri,
        );

        let token_object = object::object_from_constructor_ref<Token>(&constructor_ref);
        let token_address = object::object_address(&token_object);

        // Register the token ID as used
        register_token_id(token_id);

        // Create metadata and store it in token's resources
        let token_signer = object::generate_signer(&constructor_ref);
        let metadata = UFCTokenMetadata {
            id: token_id,
            fighter_name,
            weight_class,
            record,
            ranking,
            token_address,
        };
        move_to(&token_signer, metadata);

        // Emit token minted event
        let collection_events = borrow_global_mut<CollectionEvents>(@UFC_NFT);
        event::emit_event(
            &mut collection_events.token_minted_events,
            TokenMintedEvent {
                token_id: token_address,
                metadata_id: token_id,
                creator: signer::address_of(creator),
                collection,
                name,
                uri,
                description,
                fighter_name,
                weight_class,
                record,
                ranking,
            },
        );
    }
    
    /// Mint a new token with a custom ID and transfer it directly to the recipient
    public entry fun mint_token_for(
        creator: &signer,
        recipient: address,
        token_id: u64,
        collection: String,
        name: String,
        uri: String,
        description: String,
        fighter_name: String,
        weight_class: String,
        record: String,
        ranking: u64,
    ) acquires CollectionEvents, TokenRegistry {
        assert!(string::length(&name) <= MAX_STRING_LENGTH, error::invalid_argument(ETOKEN_NAME_TOO_LONG));
        assert!(string::length(&uri) <= MAX_STRING_LENGTH, error::invalid_argument(ETOKEN_URI_TOO_LONG));
        assert!(string::length(&description) <= MAX_STRING_LENGTH, error::invalid_argument(ETOKEN_DESCRIPTION_TOO_LONG));
        
        // Check if token ID is already used
        assert!(!is_token_id_used(token_id), error::already_exists(ETOKEN_ID_ALREADY_EXISTS));

        let constructor_ref = token::create_named_token(
            creator,
            collection,
            description,
            name,
            option::none(),
            uri,
        );

        let token_object = object::object_from_constructor_ref<Token>(&constructor_ref);
        let token_address = object::object_address(&token_object);

        // Register the token ID as used
        register_token_id(token_id);

        // Create metadata and store it in token's resources
        let token_signer = object::generate_signer(&constructor_ref);
        let metadata = UFCTokenMetadata {
            id: token_id,
            fighter_name,
            weight_class,
            record,
            ranking,
            token_address,
        };
        move_to(&token_signer, metadata);
        
        // Transfer the token to the recipient
        object::transfer(creator, token_object, recipient);

        // Emit token minted event
        let collection_events = borrow_global_mut<CollectionEvents>(@UFC_NFT);
        event::emit_event(
            &mut collection_events.token_minted_events,
            TokenMintedEvent {
                token_id: token_address,
                metadata_id: token_id,
                creator: signer::address_of(creator),
                collection,
                name,
                uri,
                description,
                fighter_name,
                weight_class,
                record,
                ranking,
            },
        );
    }
} 