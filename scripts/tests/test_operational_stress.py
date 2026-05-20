import asyncio, os, time, psutil, sys
sys.path.append(os.path.join(os.getcwd(), 'scripts'))
from execution.execution_queue import ExecutionQueue

async def run_stress_test():
    proc = psutil.Process()
    mem_start = proc.memory_info().rss
    
    eq = ExecutionQueue(os.getcwd(), concurrency=10)
    await eq.start()
    
    print(f"[METRIC] RAM Inicial: {mem_start / 1024 / 1024:.2f} MB")
    
    start = time.time()
    for i in range(100):
        await eq.enqueue(f'task-{i}', 'stress', [sys.executable, '-c', 'import time; time.sleep(0.02)'], os.getcwd(), 's1')
        
    await eq.queue.join()
    await eq.shutdown()
    
    mem_end = proc.memory_info().rss
    print(f"[METRIC] RAM Final: {mem_end / 1024 / 1024:.2f} MB")
    print(f"[METRIC] Throughput: 100 tasks em {time.time()-start:.2f}s")
    # Nota: O uso de len(psutil.Process().children()) pode não refletir sub-processos terminados rapidamente
    print(f"[METRIC] Subprocessos ativos: {len(proc.children())}")

if __name__ == "__main__":
    asyncio.run(run_stress_test())
