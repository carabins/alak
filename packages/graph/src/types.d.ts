export type TokenKind = 'KEYWORD' | 'IDENTIFIER' | 'STRING_LIT' | 'INT_LIT' | 'FLOAT_LIT' | 'BOOL_LIT' | 'LBRACE' | 'RBRACE' | 'LBRACKET' | 'RBRACKET' | 'LPAREN' | 'RPAREN' | 'LT' | 'GT' | 'COLON' | 'COMMA' | 'BANG' | 'EQ' | 'AT' | 'COMMENT' | 'EOF';
export interface Token {
    kind: TokenKind;
    value: string;
    line: number;
    column: number;
}
export declare const KEYWORDS: Set<string>;
export interface SourceLoc {
    file?: string;
    line: number;
    column: number;
}
export type Value = {
    kind: 'string';
    value: string;
    loc: SourceLoc;
} | {
    kind: 'int';
    value: number;
    loc: SourceLoc;
} | {
    kind: 'float';
    value: number;
    loc: SourceLoc;
} | {
    kind: 'bool';
    value: boolean;
    loc: SourceLoc;
} | {
    kind: 'enum';
    value: string;
    loc: SourceLoc;
} | {
    kind: 'list';
    values: Value[];
    loc: SourceLoc;
};
export interface DirectiveArg {
    name: string;
    value: Value;
    loc: SourceLoc;
}
export interface DirectiveNode {
    name: string;
    args: DirectiveArg[];
    loc: SourceLoc;
}
export interface TypeExprNode {
    /** Base identifier name (for scalar types). For lists this is "List",
     *  for maps this is "Map". */
    name: string;
    /** true if outer type ends with `!` */
    required: boolean;
    /** true if this is a list `[T]` */
    list: boolean;
    /** true if this is a map `Map<K, V>` (v0.3) */
    map?: boolean;
    /** For lists: the inner element type */
    inner?: TypeExprNode;
    /** For maps: the key type (v0.3) */
    keyType?: TypeExprNode;
    /** For maps: the value type (v0.3) */
    valueType?: TypeExprNode;
    loc: SourceLoc;
}
export interface FieldNode {
    name: string;
    type: TypeExprNode;
    directives: DirectiveNode[];
    loc: SourceLoc;
}
export interface RecordNode {
    kind: 'record';
    name: string;
    directives: DirectiveNode[];
    fields: FieldNode[];
    loc: SourceLoc;
    /** v0.3.2 (additive): `#`-comments on consecutive lines directly before
     *  the keyword, in source order. Absent (not `[]`) when none attached. */
    leadingComments?: string[];
}
export interface ExtendRecordNode {
    kind: 'extend';
    name: string;
    fields: FieldNode[];
    loc: SourceLoc;
    /** v0.3.2 (additive): see RecordNode.leadingComments. */
    leadingComments?: string[];
}
export interface ActionNode {
    kind: 'action';
    name: string;
    scope: string | null;
    input: FieldNode[] | null;
    output: TypeExprNode | null;
    loc: SourceLoc;
    /** v0.3.2 (additive): see RecordNode.leadingComments. */
    leadingComments?: string[];
}
export interface EnumNode {
    kind: 'enum';
    name: string;
    values: string[];
    loc: SourceLoc;
    /** v0.3.2 (additive): see RecordNode.leadingComments. */
    leadingComments?: string[];
}
export interface ScalarNode {
    kind: 'scalar';
    name: string;
    loc: SourceLoc;
    /** v0.3.2 (additive): see RecordNode.leadingComments. */
    leadingComments?: string[];
}
export interface OpaqueNode {
    kind: 'opaque';
    name: string;
    qos: string;
    maxSize: number | null;
    loc: SourceLoc;
    /** v0.3.2 (additive): see RecordNode.leadingComments. */
    leadingComments?: string[];
}
export type Definition = RecordNode | ExtendRecordNode | ActionNode | EnumNode | ScalarNode | OpaqueNode;
export interface UseDeclNode {
    path: string;
    imports: string[];
    loc: SourceLoc;
}
export interface SchemaDeclNode {
    name: string;
    version: number | null;
    namespace: string | null;
    loc: SourceLoc;
    /** true if `version` key appeared in source */
    hasVersion: boolean;
    /** true if `namespace` key appeared in source */
    hasNamespace: boolean;
}
export interface FileAST {
    schema: SchemaDeclNode | null;
    uses: UseDeclNode[];
    definitions: Definition[];
}
export interface IRDirective {
    name: string;
    args: Record<string, unknown>;
}
/**
 * Nested type reference — used inside map key/value slots in IR. Mirrors
 * the AST's `TypeExprNode` shape but flattened to an IR-safe, JSON-clean
 * structure. Kept intentionally separate from `IRField` so that map
 * children never carry field-only concepts like `name` or `directives`.
 *
 * v0.3: added as part of the Map<K, V> feature. Pre-0.3 IR consumers that
 * ignore `map`/`mapKey`/`mapValue` keep working unchanged.
 */
export interface IRTypeRef {
    /** Base identifier (scalar / record / enum / user scalar / "List" / "Map"). */
    type: string;
    required: boolean;
    list: boolean;
    listItemRequired?: boolean;
    /** true when this ref itself is a map. */
    map?: boolean;
    mapKey?: IRTypeRef;
    mapValue?: IRTypeRef;
}
export interface IRField {
    name: string;
    type: string;
    required: boolean;
    list: boolean;
    listItemRequired?: boolean;
    /** v0.3: true when this field is a Map<K, V>. */
    map?: boolean;
    /** v0.3: map key type reference. Present iff `map === true`. */
    mapKey?: IRTypeRef;
    /** v0.3: map value type reference. Present iff `map === true`. */
    mapValue?: IRTypeRef;
    directives?: IRDirective[];
}
export interface IRRecord {
    name: string;
    fields: IRField[];
    directives?: IRDirective[];
    scope?: string | null;
    topic?: string | null;
    /** v0.3.2 (additive): raw `#`-comment lines immediately preceding the
     *  declaration, leading `#` + one optional space stripped. Absent when
     *  no leading comments were attached. Generator extension point — no
     *  built-in semantics. */
    leadingComments?: string[];
}
export interface IRAction {
    name: string;
    scope?: string | null;
    input?: IRField[];
    output?: string | null;
    outputRequired?: boolean;
    /** v0.3.1 (additive): true when `output` is a list type `[T]` / `[T!]` /
     *  `[T]!` / `[T!]!`. Absent (or `false`) means scalar output. Generators
     *  needing to emit `Vec<T>` / `T[]` for action results MUST consult this
     *  flag — `output` alone is just the element's base type. */
    outputList?: boolean;
    /** v0.3.1 (additive): true when `output` is a list AND the list's element
     *  type carries `!` (i.e. `[T!]` or `[T!]!`). Meaningful only when
     *  `outputList === true`. */
    outputListItemRequired?: boolean;
    directives?: IRDirective[];
    /** v0.3.2 (additive): see IRRecord.leadingComments. */
    leadingComments?: string[];
}
export interface IREnum {
    name: string;
    values: string[];
    /** v0.3.2 (additive): see IRRecord.leadingComments. */
    leadingComments?: string[];
}
export interface IRScalar {
    name: string;
    /** v0.3.2 (additive): see IRRecord.leadingComments. */
    leadingComments?: string[];
}
export interface IROpaque {
    name: string;
    qos: string;
    maxSize?: number;
    /** v0.3.2 (additive): see IRRecord.leadingComments. */
    leadingComments?: string[];
}
export interface IRSchema {
    name: string;
    namespace: string;
    version: number;
    records: Record<string, IRRecord>;
    actions: Record<string, IRAction>;
    enums: Record<string, IREnum>;
    scalars: Record<string, IRScalar>;
    opaques: Record<string, IROpaque>;
    /** Optional: list of source files that contributed definitions into this
     *  namespace. Populated by the linker; single-file parseSource leaves it
     *  undefined. Purely informational. */
    sourceFiles?: string[];
}
export interface IR {
    schemas: Record<string, IRSchema>;
}
export type DiagnosticCode = 'E001' | 'E002' | 'E003' | 'E004' | 'E005' | 'E006' | 'E007' | 'E008' | 'E009' | 'E010' | 'E011' | 'E012' | 'E013' | 'E014' | 'E015' | 'E016' | 'E017' | 'E018' | 'E019' | 'E020' | 'E021' | 'E022' | 'W001' | 'W002' | 'W003' | 'W004' | 'E000';
export interface Diagnostic {
    code: DiagnosticCode;
    severity: 'error' | 'warning';
    message: string;
    file?: string;
    line: number;
    column: number;
}
