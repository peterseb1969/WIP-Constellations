# @wip/client — TypeScript Client Library

*WIP Design Specification*

*DRAFT — March 2026*

---

# Purpose

This document specifies the design of @wip/client, the official TypeScript client library for World In a Pie. The library is part of the WIP distribution, versioned in lockstep with WIP’s API services. It provides a typed, ergonomic layer over WIP’s HTTP APIs for TypeScript and JavaScript consumers.

> **WIP’s APIs are the interface — this library is a convenience**
>
> WIP’s RESTful HTTP APIs are the primary and authoritative way to interact with the platform. Any language, any HTTP client, any automation tool can use them directly. The @wip/client library is an optional convenience layer that adds type safety, authentication management, bulk abstraction, and error normalisation for TypeScript consumers. It is strongly recommended for constellation apps and AI-assisted development, where consistency and reduced error surface are critical. But it is not required — using WIP’s APIs directly is always a valid choice.

The library serves three audiences:

- **Application developers** (human or AI) building apps on WIP. They get typed methods, authentication handling, and meaningful error messages without learning WIP’s internal API conventions.

- **Script authors** writing data import/export pipelines, test suites, or automation. They get the same typed interface in Node.js that apps get in the browser.

- **The AI-Assisted Development process** described in WIP’s companion documentation. The client library reduces the AI’s decision surface by providing a correct, tested integration layer rather than requiring the AI to compose raw HTTP calls.

# Design Principles

## Thin and typed

The library wraps HTTP calls and adds type safety, authentication, and error normalisation. It does not impose a state management strategy, a UI framework, or a caching layer. A React app uses it with TanStack Query; a Vue app uses it with Pinia; a CLI script uses it with plain async/await. The client does not care.

## Isomorphic

The library runs in both browser and Node.js environments. Constellation apps use it in the browser; data import scripts, test suites, and the AI-Assisted Development process use it from Node. The HTTP primitive is fetch (available natively in both environments since Node 18), with no dependency on axios, node-fetch, or browser-specific APIs.

## Bulk abstraction

> **The core design decision**
> WIP’s APIs are bulk-first: all create/update operations accept arrays and always return HTTP 200 with per-item results. This is efficient and consistent at the API level, but it pushes complexity to every consumer. A naïve app that checks response.ok and assumes success has a latent bug — the HTTP 200 only means the batch was processed; individual items may have failed validation, reference resolution, or conflict checks. The client library absorbs this complexity entirely.

The client provides both single-item and bulk interfaces. Single-item methods wrap the input into a one-element array, send it to the bulk endpoint, unwrap the response, inspect the per-item result, and either return the successful entity or throw a typed error. The caller never sees the bulk wrapper, never sees HTTP 200 with a buried failure, and never parses bulk response structures.

Bulk methods expose the full per-item result set with structured success/failure reporting, progress callbacks, and chunking. They are the honest representation of what WIP’s API actually does.

## Error normalisation

All errors — whether from HTTP-level failures (network, authentication, server) or from item-level failures extracted from bulk responses (validation, resolution, conflict) — arrive through a single typed error hierarchy. The caller handles errors the same way regardless of their origin.

## Version-locked

The client library is versioned identically to WIP’s API services. Version 1.5.0 of @wip/client is designed to work with WIP 1.5.0. This eliminates compatibility guesswork and ensures that type definitions match the API surface at all times.

## Types auto-generated

TypeScript type definitions for all WIP entities are generated from the OpenAPI/Swagger specifications produced by WIP’s FastAPI services. This guarantees alignment between the client’s type system and the API’s actual behaviour. Hand-maintained types would inevitably drift; generated types cannot.

# Package Structure

The WIP client ships as two npm packages:

|                 |                                                                                                                                                          |                                                                             |
|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| **Package**     | **Scope**                                                                                                                                                | **Dependencies**                                                            |
| **@wip/client** | Core client library. Framework-agnostic. Isomorphic (browser + Node.js). All service classes, auth, error types, generated types, and utilities.         | Zero runtime dependencies. Uses native fetch. TypeScript as dev dependency. |
| **@wip/react**  | React companion. Pre-built TanStack Query hooks for common operations. Thin wrapper around @wip/client that eliminates useQuery/useMutation boilerplate. | @wip/client (peer), react, @tanstack/react-query (peers).                   |

Source layout: @wip/client

@wip/client/

src/

index.ts \# Main export: createWipClient(config)

client.ts \# WipClient class composing all services

config.ts \# WipClientConfig type and defaults

services/

def-store.ts \# DefStoreService class

template-store.ts \# TemplateStoreService class

document-store.ts \# DocumentStoreService class

registry.ts \# RegistryService class

reporting-sync.ts \# ReportingSyncService class

auth/

index.ts \# AuthProvider interface

api-key.ts \# ApiKeyAuthProvider

oidc.ts \# OidcAuthProvider

errors/

index.ts \# WipError base class + all subtypes

mapper.ts \# HTTP response → WipError mapping

bulk-extractor.ts \# Bulk response → per-item WipError extraction

types/

generated.ts \# Auto-generated from OpenAPI specs

index.ts \# Re-exports + any manual augmentations

utils/

form-schema.ts \# templateToFormSchema()

bulk-import.ts \# bulkImport() with chunking + progress

reference-resolver.ts \# resolveReference() for picker UIs

scripts/

generate-types.ts \# OpenAPI → TypeScript codegen script

tests/

unit/ \# Unit tests (mocked HTTP)

integration/ \# Integration tests (live WIP instance)

Source layout: @wip/react

@wip/react/

src/

index.ts \# Main exports

provider.tsx \# WipProvider (React context for client instance)

hooks/

use-documents.ts \# useDocuments, useDocument, useCreateDocument

use-templates.ts \# useTemplate, useTemplates

use-terminologies.ts \# useTerminology, useTerms

use-files.ts \# useUploadFile, useFileUrl

use-form-schema.ts \# useFormSchema (template → form descriptor)

# Client Initialisation

## Configuration

import { createWipClient } from '@wip/client';

const wip = createWipClient({

// Required

host: 'https://wip-pi.local', // Base URL (gateway or direct)

// Authentication (one of):

auth: { mode: 'api-key', key: 'my-api-key' },

// OR

auth: { mode: 'oidc', tokenProvider: () =\> getAccessToken() },

// Optional

namespace: 'default', // Default namespace for all operations

timeout: 30000, // Request timeout in ms (default: 30s)

retries: 3, // Auto-retry for GET requests (default: 3)

retryDelay: 1000, // Initial retry delay in ms (default: 1000)

onError: (error) =\> log(error), // Global error hook

});

The host URL can point to the gateway (which routes /api/\* to the correct services) or directly to individual services if no gateway is deployed. When using the gateway, all services share the same origin, simplifying CORS. When using direct access, the client constructs per-service URLs from the host and standard port offsets (Registry: 8001, Def-Store: 8002, Template-Store: 8003, Document-Store: 8004, Reporting-Sync: 8005), or accepts explicit per-service overrides.

## Service access

// All services accessible as properties:

wip.defStore // DefStoreService

wip.templates // TemplateStoreService

wip.documents // DocumentStoreService

wip.registry // RegistryService

wip.reportingSync // ReportingSyncService

# Service Specifications

## DefStoreService

Wraps WIP’s Def-Store API for terminology and term management, plus ontology relationship operations.

### Terminology operations

|                               |                                |                                                                             |
|-------------------------------|--------------------------------|-----------------------------------------------------------------------------|
| **Method**                    | **Returns**                    | **Notes**                                                                   |
| **getByCode(code)**           | Terminology                    | Fetches terminology by code. Throws WipNotFoundError if not found.          |
| **getById(id)**               | Terminology                    | Fetches by WIP ID (e.g., DEF-000001).                                       |
| **list(filters?)**            | PaginatedResult\<Terminology\> | Lists terminologies with optional filtering and pagination.                 |
| **create(terminology)**       | Terminology                    | Single-item create. Wraps bulk endpoint, unwraps result, throws on failure. |
| **createBulk(terminologies)** | BulkResult\<Terminology\>      | Bulk create with per-item success/failure reporting.                        |

### Term operations

|                                           |                         |                                                                       |
|-------------------------------------------|-------------------------|-----------------------------------------------------------------------|
| **Method**                                | **Returns**             | **Notes**                                                             |
| **getTerms(terminologyId, filters?)**     | PaginatedResult\<Term\> | Lists terms within a terminology. Supports search by value and alias. |
| **createTerm(terminologyId, term)**       | Term                    | Single-item create. Wraps bulk, unwraps, throws on failure.           |
| **createTermsBulk(terminologyId, terms)** | BulkResult\<Term\>      | Bulk create with per-item results.                                    |
| **validateTerms(validations)**            | ValidationResult\[\]    | Validate term values against terminologies without creating anything. |

### Ontology operations

|                                        |                                |                                                                              |
|----------------------------------------|--------------------------------|------------------------------------------------------------------------------|
| **Method**                             | **Returns**                    | **Notes**                                                                    |
| **createRelationships(relationships)** | BulkResult\<TermRelationship\> | Bulk create term relationships.                                              |
| **getRelationships(termId, opts?)**    | TermRelationship\[\]           | List relationships for a term. Options: direction (incoming/outgoing), type. |
| **getAncestors(termId, opts?)**        | TraversalResult                | Transitive ancestor traversal. Options: type (default is_a), maxDepth.       |
| **getDescendants(termId, opts?)**      | TraversalResult                | Transitive descendant traversal.                                             |

## TemplateStoreService

|                           |                             |                                                                                                                |
|---------------------------|-----------------------------|----------------------------------------------------------------------------------------------------------------|
| **Method**                | **Returns**                 | **Notes**                                                                                                      |
| **getByCode(code)**       | Template                    | Fetches latest active version. Returns resolved template (inherited + own fields).                             |
| **getById(id, version?)** | Template                    | Fetches specific template. Optional version parameter for pinning.                                             |
| **getOwnFields(id)**      | Template                    | Fetches template with only its own (non-inherited) fields. Use this for updates to avoid breaking inheritance. |
| **list(filters?)**        | PaginatedResult\<Template\> | Lists templates with optional filtering.                                                                       |
| **create(template)**      | Template                    | Single-item create. Wraps bulk, unwraps, throws on failure.                                                    |
| **update(id, fields)**    | Template                    | Updates template. Accepts only own fields to preserve inheritance.                                             |
| **getChildren(id)**       | Template\[\]                | Direct child templates.                                                                                        |
| **getDescendants(id)**    | Template\[\]                | All descendant templates (recursive).                                                                          |
| **cascade(id)**           | CascadeResult               | Propagate parent changes to pinned child templates.                                                            |

## DocumentStoreService

This is the most heavily used service. The bulk abstraction is critical here, as document creation is where validation, reference resolution, and identity hashing failures surface.

### Document operations

|                                          |                             |                                                                                                                                           |
|------------------------------------------|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| **Method**                               | **Returns**                 | **Notes**                                                                                                                                 |
| **create(templateId, data, opts?)**      | Document                    | Single-item create. Wraps in array, sends to bulk endpoint, unwraps. Throws typed error on item-level failure. opts: synonyms, namespace. |
| **createBulk(templateId, items, opts?)** | BulkResult\<Document\>      | Bulk create with chunking, progress callbacks, and per-item results. See Bulk Import Utility below.                                       |
| **getById(id)**                          | Document                    | Fetch document by WIP document ID.                                                                                                        |
| **query(templateCode, opts?)**           | PaginatedResult\<Document\> | Query documents by template code. Options: filters, sort, page, pageSize.                                                                 |
| **getTable(templateId, opts?)**          | TableResult                 | Table view for a template. Flattened, tabular representation.                                                                             |
| **deactivate(id)**                       | Document                    | Soft delete. Sets status to inactive.                                                                                                     |
| **checkIntegrity()**                     | IntegrityReport             | Run referential integrity check across all documents.                                                                                     |

### File operations

|                             |                        |                                                                                                                               |
|-----------------------------|------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| **Method**                  | **Returns**            | **Notes**                                                                                                                     |
| **uploadFile(file, opts?)** | FileMetadata           | Upload file to MinIO via Document-Store. Returns FILE-XXXXXX identifier for linking to documents. Supports progress callback. |
| **getFileUrl(fileId)**      | string                 | Get pre-signed download URL for a file.                                                                                       |
| **getFileContent(fileId)**  | Blob \| ReadableStream | Stream file content directly. Returns Blob in browser, ReadableStream in Node.                                                |
| **listOrphans()**           | FileMetadata\[\]       | List files not referenced by any document.                                                                                    |

## RegistryService

|                                     |               |                                                                                         |
|-------------------------------------|---------------|-----------------------------------------------------------------------------------------|
| **Method**                          | **Returns**   | **Notes**                                                                               |
| **lookup(identifier)**              | RegistryEntry | Resolve any identifier (canonical ID, synonym, or external code) to its registry entry. |
| **addSynonyms(entityId, synonyms)** | RegistryEntry | Register external identifiers (legacy IDs, cross-system codes) for an entity.           |

# Error Hierarchy

> **Dual-origin error normalisation**
> WIP errors come from two sources: HTTP-level failures (network, auth, server errors) and item-level failures buried inside HTTP 200 bulk responses (validation, resolution, conflict). The client normalises both into a single hierarchy. The caller handles errors the same way regardless of origin.

## Error types

|                        |            |                                                                                                                                                                                                                                                                  |
|------------------------|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Error Class**        | **Origin** | **Properties and Usage**                                                                                                                                                                                                                                         |
| **WipError**           | Both       | Abstract base class. All WIP errors extend this. Properties: message, code (string identifier), cause (original error if wrapping).                                                                                                                              |
| **WipValidationError** | Item-level | One or more fields failed validation. Properties: fields: Array\<{field: string, message: string, value?: any}\>. UI maps these directly to inline form errors.                                                                                                  |
| **WipResolutionError** | Item-level | A term value or document reference could not be resolved. Properties: field: string, value: string, terminologyCode?: string, templateCode?: string. Example: "The value 'Actve' in field 'status' does not match any value or alias in the STATUS terminology." |
| **WipConflictError**   | Item-level | Version conflict on upsert. Properties: documentId: string, expectedVersion: number, actualVersion: number.                                                                                                                                                      |
| **WipNotFoundError**   | HTTP       | Entity not found (HTTP 404). Properties: entityType: string, identifier: string.                                                                                                                                                                                 |
| **WipAuthError**       | HTTP       | Authentication or authorisation failure (HTTP 401/403). Properties: reason: 'unauthenticated' \| 'unauthorized'.                                                                                                                                                 |
| **WipServerError**     | HTTP       | Unexpected server error (HTTP 500+). Properties: statusCode: number, serverMessage?: string.                                                                                                                                                                     |
| **WipNetworkError**    | HTTP       | Could not reach the server. Properties: url: string, cause: Error. Relevant for Raspberry Pi on local network — the Pi may be off or the user on the wrong WiFi.                                                                                                 |

## Usage pattern

try {

const doc = await wip.documents.create(templateId, data);

showSuccess('Document saved');

} catch (e) {

if (e instanceof WipValidationError) {

// Highlight fields: e.fields.forEach(f =\> markField(f.field, f.message))

} else if (e instanceof WipResolutionError) {

// Show: \`Value "\${e.value}" not found in \${e.terminologyCode}\`

} else if (e instanceof WipAuthError) {

// Redirect to login or show session expired

} else if (e instanceof WipNetworkError) {

// Show connectivity banner with retry button

}

}

# Bulk Result Type

All bulk methods return a BulkResult that provides a complete accounting of what happened:

interface BulkResult\<T\> {

succeeded: T\[\]; // Successfully created/updated entities

failed: Array\<{

index: number; // Position in input array

item: any; // The input that failed

error: WipError; // Typed error (same hierarchy as single-item)

}\>;

summary: {

total: number; // Total items submitted

created: number; // New entities created

updated: number; // Existing entities versioned (identity match)

errors: number; // Items that failed

};

}

The summary distinguishes created from updated because WIP’s upsert semantics mean both happen in the same call. A bulk import of bank transactions may create 50 new records and version-update 3 that were previously imported — the caller should know the difference.

## Chunking and progress

const result = await wip.documents.createBulk(templateId, rows, {

chunkSize: 100, // Items per API call (default: 100)

onProgress: (progress) =\> {

// progress.processed: number (items sent so far)

// progress.total: number (total items)

// progress.succeeded: number (successful so far)

// progress.failed: number (failed so far)

updateProgressBar(progress);

},

continueOnError: true, // Process all chunks even if some items fail (default: true)

});

Chunks are sent sequentially (not in parallel) to avoid overwhelming the Raspberry Pi. The progress callback fires after each chunk completes, enabling responsive UI feedback during large imports.

# Utility Functions

templateToFormSchema(template)

Converts a WIP template definition into a form field descriptor array that a generic form renderer can consume. This bridges the gap between WIP’s data model and the UI layer.

const schema = templateToFormSchema(template);

// Returns: FormField\[\]

interface FormField {

name: string; // Field name from template

label: string; // Human-readable label

type: 'text' \| 'number' \| 'integer' \| 'date' \| 'boolean'

\| 'term' \| 'reference' \| 'file' \| 'array' \| 'object';

required: boolean;

isIdentity: boolean; // True for identity fields (drives versioning)

terminologyCode?: string; // For type:'term' — which terminology to load

referenceTemplateCode?: string; // For type:'reference' — target template

arrayItemSchema?: FormField\[\]; // For type:'array' — nested field definitions

objectSchema?: FormField\[\]; // For type:'object' — nested field definitions

metadata?: Record\<string, any\>; // Any additional field metadata from template

}

resolveReference(templateCode, searchTerm)

Searches for documents matching a reference field’s target template, returning enough information to populate a reference picker in the UI.

const matches = await wip.utils.resolveReference('CUSTOMER', 'Acme');

// Returns: Array\<{

// documentId: string,

// displayValue: string, // Composed from identity fields

// identityFields: Record\<string, any\>

// }\>

The displayValue is constructed from the target template’s identity fields, giving the user enough context to select the right entity.

# React Companion: @wip/react

The React companion provides pre-built TanStack Query hooks that eliminate boilerplate and ensure consistent caching, loading states, and error handling across all constellation apps.

## WipProvider

import { WipProvider } from '@wip/react';

import { createWipClient } from '@wip/client';

const wip = createWipClient({ host: '...', auth: { ... } });

function App() {

return (

\<WipProvider client={wip}\>

\<QueryClientProvider client={queryClient}\>

\<RouterProvider router={router} /\>

\</QueryClientProvider\>

\</WipProvider\>

);

}

## Query hooks

|                                       |                                                |                                                                                                         |
|---------------------------------------|------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| **Hook**                              | **Wraps**                                      | **Returns**                                                                                             |
| **useDocuments(templateCode, opts?)** | documents.query()                              | { data: PaginatedResult\<Document\>, isLoading, error, refetch }                                        |
| **useDocument(id)**                   | documents.getById()                            | { data: Document, isLoading, error }                                                                    |
| **useCreateDocument()**               | documents.create()                             | { mutate, isPending, error, isSuccess }. Automatically invalidates query cache on success.              |
| **useTemplate(code)**                 | templates.getByCode()                          | { data: Template, isLoading, error }. Cached aggressively (templates change rarely).                    |
| **useTerminology(code)**              | defStore.getByCode() + getTerms()              | { data: { terminology, terms }, isLoading, error }. Fetches both terminology and its terms in one hook. |
| **useFormSchema(templateCode)**       | templates.getByCode() + templateToFormSchema() | { data: FormField\[\], isLoading, error }. Combines template fetch and schema conversion.               |
| **useUploadFile()**                   | documents.uploadFile()                         | { mutate, isPending, progress }. Exposes upload progress for UI feedback.                               |

## Cache strategy

- **Templates and terminologies:** staleTime: 5 minutes. These change rarely and are safe to cache. Manual invalidation available via refetch.

- **Documents:** staleTime: 30 seconds. These change more frequently. Mutations (create/update) automatically invalidate relevant query caches.

- **File URLs:** staleTime: 10 minutes. Pre-signed URLs have their own expiry; cache aligns with that.

# Type Generation

TypeScript types are auto-generated from the OpenAPI specifications produced by WIP’s FastAPI services. This is a build-time step in the WIP release process, not a runtime operation.

## Generation pipeline

- **Step 1:** During WIP’s CI/release build, fetch the OpenAPI JSON from each running service (Registry, Def-Store, Template-Store, Document-Store, Reporting-Sync).

- **Step 2:** Run the generation script (scripts/generate-types.ts) which uses openapi-typescript to produce TypeScript interfaces from the schemas.

- **Step 3:** Post-process the generated types: add JSDoc comments from OpenAPI descriptions, export under clean names (Terminology, Term, Template, Document, etc.), and merge any manual augmentations (utility types, discriminated unions).

- **Step 4:** Write to src/types/generated.ts, which is committed to the repository as part of the release.

## Key generated types

|                      |                    |                                                                                               |
|----------------------|--------------------|-----------------------------------------------------------------------------------------------|
| **Type**             | **Source Service** | **Description**                                                                               |
| **Terminology**      | Def-Store          | Terminology definition: code, name, description, status, metadata.                            |
| **Term**             | Def-Store          | Term within a terminology: value, aliases, description, translations, parent, status.         |
| **TermRelationship** | Def-Store          | Typed, directed relationship between two terms.                                               |
| **Template**         | Template-Store     | Template definition: code, name, fields (typed, with constraints), identity fields, extends.  |
| **TemplateField**    | Template-Store     | Field definition: name, label, type, required, terminology ref, template ref, inherited flag. |
| **Document**         | Document-Store     | Stored document: document_id, template_id, version, data, references, identity_hash, status.  |
| **FileMetadata**     | Document-Store     | File record: file_id (FILE-XXXXXX), filename, content_type, size, referenced_by.              |
| **RegistryEntry**    | Registry           | Registry record: entity_id, namespace, entity_type, synonyms, status.                         |

# Testing Strategy

Unit tests (mocked HTTP)

- Every service method has unit tests verifying correct request construction (URL, headers, body)

- Bulk abstraction tests: verify that single-item methods wrap, unwrap, and throw correctly for each error type

- Error mapping tests: verify that each HTTP status and each bulk item failure maps to the correct WipError subclass

- Auth provider tests: verify correct header attachment for API key and OIDC modes

Integration tests (live WIP instance)

- Run against a WIP instance in a test namespace (isolated from production data)

- Full CRUD cycle: create terminology → create terms → create template → create document → query → update → verify version

- Bulk import: create 100+ documents, verify per-item results, verify chunking and progress callbacks

- Error scenarios: submit invalid data, verify correct WipError subtype is thrown with correct field details

- File operations: upload → link to document → download → verify content integrity

- Reference resolution: create referenced document, create referencing document, verify reference resolves

### React hook tests

- Render hooks with mock WipClient, verify loading/success/error state transitions

- Verify cache invalidation after mutations

- Verify that useFormSchema produces correct FormField arrays for various template configurations

# Implementation Phases

|           |                          |                                                                                                                                                                                |
|-----------|--------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Phase** | **Deliverable**          | **Scope**                                                                                                                                                                      |
| **1**     | **Core client + errors** | WipClient class, config, auth providers (API key + OIDC), error hierarchy, HTTP-level error mapping. Enough to make authenticated requests and get typed errors back.          |
| **2**     | **Bulk abstraction**     | Bulk response parsing, per-item error extraction, single-item wrap/unwrap for all services. BulkResult type. This is the most critical phase — it solves the HTTP 200 problem. |
| **3**     | **Service classes**      | DefStoreService, TemplateStoreService, DocumentStoreService, RegistryService, ReportingSyncService. Full API surface with single-item and bulk methods.                        |
| **4**     | **Type generation**      | OpenAPI-to-TypeScript generation script. Integration into WIP build pipeline. Generated types for all entities.                                                                |
| **5**     | **Utilities**            | templateToFormSchema(), bulkImport() with chunking and progress, resolveReference().                                                                                           |
| **6**     | **@wip/react**           | WipProvider, all query/mutation hooks, cache strategy. Depends on Phases 1–5.                                                                                                  |
| **7**     | **Documentation**        | API reference (auto-generated from TSDoc), getting started guide, migration guide from raw HTTP calls. Published alongside WIP’s documentation.                                |

> **Relationship to the constellation experiment**
> The Financial constellation’s Statement Manager is the first real consumer of @wip/client. Implementation can begin with Phases 1–3 (core client, bulk abstraction, service classes), which is enough to build working apps. Phase 4 (type generation) and Phase 6 (@wip/react) can follow incrementally. The constellation experiment both drives and validates the client library: every issue encountered during app development feeds back into the library’s design.

# Scope Boundaries

## In scope

- Typed service classes for all WIP API endpoints

- Authentication (API key and OIDC/JWT) with automatic header management

- Bulk abstraction: single-item wrap/unwrap with item-level error extraction

- Error normalisation: unified typed hierarchy for HTTP and item-level errors

- Auto-generated TypeScript types from OpenAPI specifications

- Utility functions: templateToFormSchema, bulkImport, resolveReference

- React companion hooks (@wip/react)

- Retry with exponential backoff for idempotent (GET) requests

- Progress callbacks for bulk operations and file uploads

## Out of scope

- **State management.** The client returns data; the app decides how to manage it. No built-in store, no reactive state beyond what @wip/react hooks provide via TanStack Query.

- **UI components.** No form renderers, tables, or visual components. The templateToFormSchema utility produces a descriptor; rendering is the app’s job.

- **Offline support.** No IndexedDB caching, sync queues, or offline-first patterns. WIP runs on a local network where the server is either reachable or it isn’t. Revisit if the deployment model expands.

- **Admin operations.** Namespace management, API key administration, and reporting sync configuration are Console/admin concerns. The client may expose them for completeness in a future phase, but they are not in the primary surface area.

- **Write retries.** Mutations (POST, PUT, DELETE) are never automatically retried, to prevent duplicate submissions. Only the caller can trigger a retry for write operations.

# Summary

The @wip/client library exists because WIP’s bulk-first API design, while correct at the platform level, creates a gap between the API’s contract and what application developers naturally expect. The library bridges that gap: it makes single-item operations feel like single-item operations, makes errors meaningful and typed, and makes the full WIP API surface accessible through a clean TypeScript interface.

As part of WIP’s distribution, the library offers a tested, correct foundation for TypeScript applications built on WIP. It is not the only way to interact with WIP — the HTTP APIs remain the authoritative interface, and consumers in any language can use them directly. But for the constellation ecosystem and AI-assisted development workflow, where consistency, type safety, and correct bulk handling are essential, the client library provides the structural discipline on the client side that WIP provides on the server side.
