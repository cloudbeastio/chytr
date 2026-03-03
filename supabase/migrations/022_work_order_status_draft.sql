-- Allow work orders to be created as draft; approve moves to pending and launches agent.
alter type work_order_status add value 'draft' before 'pending';
