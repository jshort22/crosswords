export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      puzzles: {
        Row: {
          id: string
          title: string
          author: string | null
          difficulty: number
          grid_size_rows: number
          grid_size_cols: number
          grid: Json
          clues_across: Json
          clues_down: Json
          solution: Json
          source_file_url: string | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          author?: string | null
          difficulty: number
          grid_size_rows: number
          grid_size_cols: number
          grid: Json
          clues_across: Json
          clues_down: Json
          solution: Json
          source_file_url?: string | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          author?: string | null
          difficulty?: number
          grid_size_rows?: number
          grid_size_cols?: number
          grid?: Json
          clues_across?: Json
          clues_down?: Json
          solution?: Json
          source_file_url?: string | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type PuzzleRow = Database['public']['Tables']['puzzles']['Row']
