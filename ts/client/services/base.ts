import { sleep } from "../../utils";

enum ServiceState {
    STOPPED,
    STARTING,
    RUNNING,
    STOPPING
}

export abstract class BaseService {
    private state: ServiceState;
    abstract name: string;

    constructor() {
        this.state = ServiceState.STOPPED;
    }

    get isStopped() {
        return this.state === ServiceState.STOPPED;
    }

    private change(newState: ServiceState) {
        this.state = newState;
    }

    async start() {
        if (!this.isStopped) {
            this.log(`Can't start. The service is ${ServiceState[this.state]}`);
        }
        this.log("starting");
        this.change(ServiceState.STARTING);
        await this.onStart();
        this.log("running");
        this.change(ServiceState.RUNNING);
        await this.run();
    }
    async run() {
        while (this.state !== ServiceState.STOPPING) {
            await this.onRun();
        }
        this.log("stopped");
        this.change(ServiceState.STOPPED);
    }

    async stop() {
        this.log("stopping");
        this.change(ServiceState.STOPPING);
        while (this.state != ServiceState.STOPPED) {
            await sleep(500);
            this.log("still waiting to be stopped");
        }
        await this.onStopped();
    }
    protected async onStart(): Promise<any> {}
    protected async onRun(): Promise<any> {}
    protected async onStopped(): Promise<any> {}
    protected log(messgae: string) {
        console.log(`[${this.name}] ${messgae}`);
    }
}
