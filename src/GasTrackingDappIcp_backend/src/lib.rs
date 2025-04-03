use candid::{CandidType, Deserialize};
use ic_cdk::api;
use std::cell::RefCell;
use std::collections::HashMap;

#[derive(CandidType, Deserialize, Clone)]
pub struct GasInfo {
    pub cycles_used: u64,
    pub memory_used: u64,
    pub timestamp: u64,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct TransactionRecord {
    pub transaction_type: String,
    pub gas_info: GasInfo,
}

thread_local! {
    static TRANSACTIONS: RefCell<Vec<TransactionRecord>> = RefCell::new(Vec::new());
    static STORAGE_ARRAY: RefCell<Vec<u64>> = RefCell::new(vec![0; 100]);
}

fn measure_performance() -> (u64, u64) {
    let counter = api::call::performance_counter(0);
    (counter, api::stable::stable_size() as u64 * 65536)
}

#[ic_cdk::update]
async fn record_simple_transaction() -> GasInfo {
    let (start_counter, start_memory) = measure_performance();
    
    // Simple operation (similar to Solidity version)
    let timestamp = api::time();
    let mut result = 0u64;
    for _ in 0..1000 {
        result = result.wrapping_add(timestamp);
    }
    
    let (end_counter, end_memory) = measure_performance();
    
    let gas_info = GasInfo {
        cycles_used: end_counter - start_counter,
        memory_used: end_memory - start_memory,
        timestamp,
    };

    let record = TransactionRecord {
        transaction_type: "simple".to_string(),
        gas_info: gas_info.clone(),
    };

    TRANSACTIONS.with(|transactions| {
        transactions.borrow_mut().push(record);
    });

    gas_info
}

#[ic_cdk::update]
async fn record_complex_transaction() -> GasInfo {
    let (start_counter, start_memory) = measure_performance();
    
    // Complex memory operations
    let mut arr = vec![0u64; 100];
    let mut sum = 0u64;
    
    // First loop: fill array and calculate sum
    for i in 0..100 {
        arr[i] = i as u64;
        sum = sum.wrapping_add(arr[i]);
    }
    
    // Second loop: complex calculations
    let timestamp = api::time();
    for i in 0..100 {
        arr[i] = arr[i].wrapping_mul(sum);
        arr[i] = arr[i].wrapping_div(i as u64 + 1);
        arr[i] = arr[i].wrapping_add(timestamp);
    }
    
    // Additional computations to make it more complex
    for i in 0..100 {
        for j in 0..100 {
            sum = sum.wrapping_add(arr[i].wrapping_mul(j as u64));
        }
    }
    
    let (end_counter, end_memory) = measure_performance();
    
    let gas_info = GasInfo {
        cycles_used: end_counter - start_counter,
        memory_used: end_memory - start_memory,
        timestamp,
    };

    let record = TransactionRecord {
        transaction_type: "complex".to_string(),
        gas_info: gas_info.clone(),
    };

    TRANSACTIONS.with(|transactions| {
        transactions.borrow_mut().push(record);
    });

    gas_info
}

#[ic_cdk::update]
async fn record_storage_transaction() -> GasInfo {
    let (start_counter, start_memory) = measure_performance();
    
    // Storage operations
    STORAGE_ARRAY.with(|array| {
        let mut arr = array.borrow_mut();
        
        // First loop: storage writes
        for i in 0..100 {
            arr[i] = (i as u64).wrapping_mul(2);
        }
        
        // Second loop: more storage operations
        let timestamp = api::time();
        for i in 0..100 {
            arr[i] = arr[i].wrapping_mul(3);
            arr[i] = arr[i].wrapping_div(i as u64 + 1);
            arr[i] = arr[i].wrapping_add(timestamp);
        }
        
        // Additional storage operations
        for i in 0..100 {
            for j in 0..10 {
                arr[i] = arr[i].wrapping_add(j as u64);
            }
        }
    });
    
    // Grow stable memory to demonstrate storage costs
    let current_pages = api::stable::stable_size();
    let _ = api::stable::stable_grow(current_pages + 1);
    
    let (end_counter, end_memory) = measure_performance();
    
    let gas_info = GasInfo {
        cycles_used: end_counter - start_counter,
        memory_used: end_memory - start_memory,
        timestamp: api::time(),
    };

    let record = TransactionRecord {
        transaction_type: "storage".to_string(),
        gas_info: gas_info.clone(),
    };

    TRANSACTIONS.with(|transactions| {
        transactions.borrow_mut().push(record);
    });

    gas_info
}

#[ic_cdk::query]
fn get_all_transactions() -> Vec<TransactionRecord> {
    TRANSACTIONS.with(|transactions| {
        transactions.borrow().clone()
    })
}

#[ic_cdk::query]
fn get_transactions_by_type(transaction_type: String) -> Vec<TransactionRecord> {
    TRANSACTIONS.with(|transactions| {
        transactions.borrow()
            .iter()
            .filter(|t| t.transaction_type == transaction_type)
            .cloned()
            .collect()
    })
}

#[ic_cdk::query]
fn get_gas_statistics() -> HashMap<String, Vec<GasInfo>> {
    let mut stats = HashMap::new();
    
    TRANSACTIONS.with(|transactions| {
        for record in transactions.borrow().iter() {
            stats.entry(record.transaction_type.clone())
                .or_insert_with(Vec::new)
                .push(record.gas_info.clone());
        }
    });

    stats
}

#[ic_cdk::init]
fn init() {
    STORAGE_ARRAY.with(|array| {
        let mut arr = array.borrow_mut();
        arr.clear();
        arr.resize(100, 0);
    });
}
