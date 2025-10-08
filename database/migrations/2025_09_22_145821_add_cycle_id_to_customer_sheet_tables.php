<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1) Add cycle_id to all 5 tables (parent first)
        Schema::table('customer_sheets', function (Blueprint $t) {
            if (!Schema::hasColumn('customer_sheets', 'cycle_id')) {
                $t->unsignedBigInteger('cycle_id')->nullable()->after('id');
                $t->index('cycle_id', 'customer_sheets_cycle_id_idx');
                // optional but nice: prevent same name twice in one set
                $t->unique(['cycle_id', 'sheet_name'], 'customer_sheets_cycle_name_unique');
            }
        });

        foreach (['customer_sheet_entries', 'customer_sheet_items', 'customer_loan_ledger_entries', 'customer_sheet_attachments'] as $tbl) {
            Schema::table($tbl, function (Blueprint $t) use ($tbl) {
                if (!Schema::hasColumn($tbl, 'cycle_id')) {
                    $t->unsignedBigInteger('cycle_id')->nullable()->after('id');
                    $t->index('cycle_id', $tbl . '_cycle_id_idx');
                }
            });
        }

        // 2) Backfill: parent first, then children (detect FK names dynamically)
        DB::statement("UPDATE customer_sheets SET cycle_id = 5 WHERE cycle_id IS NULL");

        // tiny helper
        $has = fn(string $table, string $col) => Schema::hasColumn($table, $col);

        /** Entries <- Sheets **/
        if ($has('customer_sheet_entries', 'customer_sheet_id')) {
            DB::statement("
        UPDATE customer_sheet_entries e
          JOIN customer_sheets cs ON cs.id = e.customer_sheet_id
        SET e.cycle_id = cs.cycle_id
        WHERE e.cycle_id IS NULL
    ");
        } elseif ($has('customer_sheet_entries', 'sheet_id')) {
            DB::statement("
        UPDATE customer_sheet_entries e
          JOIN customer_sheets cs ON cs.id = e.sheet_id
        SET e.cycle_id = cs.cycle_id
        WHERE e.cycle_id IS NULL
    ");
        }

        /** Items <- Entries (or Sheets if needed) **/
        if ($has('customer_sheet_items', 'customer_sheet_entry_id')) {
            DB::statement("
        UPDATE customer_sheet_items i
          JOIN customer_sheet_entries e ON e.id = i.customer_sheet_entry_id
        SET i.cycle_id = e.cycle_id
        WHERE i.cycle_id IS NULL
    ");
        } elseif ($has('customer_sheet_items', 'entry_id')) {
            DB::statement("
        UPDATE customer_sheet_items i
          JOIN customer_sheet_entries e ON e.id = i.entry_id
        SET i.cycle_id = e.cycle_id
        WHERE i.cycle_id IS NULL
    ");
        } elseif ($has('customer_sheet_items', 'customer_sheet_id')) {
            // rare schema: items point directly to sheet
            DB::statement("
        UPDATE customer_sheet_items i
          JOIN customer_sheets cs ON cs.id = i.customer_sheet_id
        SET i.cycle_id = cs.cycle_id
        WHERE i.cycle_id IS NULL
    ");
        }

        /** Loan Ledger <- Sheets (FK is usually customer_sheet_id or sheet_id) **/
        if ($has('customer_loan_ledger_entries', 'customer_sheet_id')) {
            DB::statement("
        UPDATE customer_loan_ledger_entries ll
          JOIN customer_sheets cs ON cs.id = ll.customer_sheet_id
        SET ll.cycle_id = cs.cycle_id
        WHERE ll.cycle_id IS NULL
    ");
        } elseif ($has('customer_loan_ledger_entries', 'sheet_id')) {
            DB::statement("
        UPDATE customer_loan_ledger_entries ll
          JOIN customer_sheets cs ON cs.id = ll.sheet_id
        SET ll.cycle_id = cs.cycle_id
        WHERE ll.cycle_id IS NULL
    ");
        }

        /** Attachments <- Entries (or Sheets if needed) **/
        if ($has('customer_sheet_attachments', 'customer_sheet_entry_id')) {
            DB::statement("
        UPDATE customer_sheet_attachments a
          JOIN customer_sheet_entries e ON e.id = a.customer_sheet_entry_id
        SET a.cycle_id = e.cycle_id
        WHERE a.cycle_id IS NULL
    ");
        } elseif ($has('customer_sheet_attachments', 'entry_id')) {
            DB::statement("
        UPDATE customer_sheet_attachments a
          JOIN customer_sheet_entries e ON e.id = a.entry_id
        SET a.cycle_id = e.cycle_id
        WHERE a.cycle_id IS NULL
    ");
        } elseif ($has('customer_sheet_attachments', 'customer_sheet_id')) {
            DB::statement("
        UPDATE customer_sheet_attachments a
          JOIN customer_sheets cs ON cs.id = a.customer_sheet_id
        SET a.cycle_id = cs.cycle_id
        WHERE a.cycle_id IS NULL
    ");
        }
    }

    public function down(): void
    {
        // drop in reverse
        foreach (['customer_sheet_attachments', 'customer_loan_ledger_entries', 'customer_sheet_items', 'customer_sheet_entries'] as $tbl) {
            Schema::table($tbl, function (Blueprint $t) use ($tbl) {
                if (Schema::hasColumn($tbl, 'cycle_id')) {
                    //  $t->dropIndex([$tbl . '_cycle_id_idx']);
                    $t->dropIndex($tbl . '_cycle_id_idx');
                    $t->dropColumn('cycle_id');
                }
            });
        }

        Schema::table('customer_sheets', function (Blueprint $t) {
            if (Schema::hasColumn('customer_sheets', 'cycle_id')) {
                $t->dropUnique('customer_sheets_cycle_name_unique');
                // $t->dropIndex(['customer_sheets_cycle_id_idx']);
                $t->dropIndex('customer_sheets_cycle_id_idx');
                $t->dropColumn('cycle_id');
            }
        });
    }
};
