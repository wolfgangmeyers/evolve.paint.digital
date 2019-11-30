import * as React from "react";
import { Config } from "../../engine/config";
import { ConfigItem } from "../../components/ConfigItem";
import { MutationTypeAppend, MutationTypePosition, MutationTypeColor, MutationTypeRotation, MutationTypeDelete } from "../../engine/mutator";
import { ConfigCheckbox } from "../../components/ConfigCheckbox";

export interface PaintingEvolverStatsProps {
    zoom: boolean;
    fps: number;
    ips: number;
    similarityText: string;
    triangleCount: number;
    stats: { [key: string]: number };
    progressSpeed: number;
    config: Config;
    brushTags: Array<string>;
}

export interface PaintingEvolverStatsState {
    config: Config;
}

export class PaintingEvolverStats extends React.Component<PaintingEvolverStatsProps, PaintingEvolverStatsState> {

    constructor(props: PaintingEvolverStatsProps) {
        super(props);
        this.state = {
            config: props.config,
        };
    }

    onUpdateFocusExponentBase(newBase: number) {
        if (newBase < 0) {
            newBase = 0;
        }
        if (newBase > 10) {
            newBase = 10;
        }
        this.state.config.focusExponent = newBase;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateFrameSkip(newFrameSkip: number) {
        if (newFrameSkip < 1) {
            newFrameSkip = 1;
        }
        if (newFrameSkip > 100) {
            newFrameSkip = 100;
        }
        this.state.config.frameSkip = newFrameSkip;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateMinColorMutation(newRate: number) {
        if (newRate < 0) {
            newRate = 0;
        }
        if (newRate >= this.state.config.maxColorMutation) {
            return;
        }
        this.state.config.minColorMutation = newRate;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateMaxColorMutation(newRate: number) {
        if (newRate >= 1 || newRate <= this.state.config.minColorMutation) {
            return;
        }
        this.state.config.maxColorMutation = newRate;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateSaveSnapshots(newValue: boolean) {
        this.state.config.saveSnapshots = newValue;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateMaxSnapshots(newValue: number) {
        if (newValue <= 0) {
            return;
        }
        if (newValue > 1800) {
            return;
        }
        this.state.config.maxSnapshots = newValue;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateEnabledMutations(mutationType: string) {
        this.state.config.enabledMutations[mutationType] = !this.state.config.enabledMutations[mutationType];
        // Make sure at least one mutation type is enabled
        let count = 0;
        for (let mutationType of [MutationTypeAppend, MutationTypeColor, MutationTypePosition, MutationTypeRotation]) {
            if (this.state.config.enabledMutations[mutationType]) {
                count++;
            }
        }
        if (count == 0) {
            this.state.config.enabledMutations[mutationType] = true;
        }
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateBrushEnabled(brushTag: string, enabled: boolean) {
        this.state.config.enabledBrushTags[brushTag] = enabled;
        // Ensure that at least one brush is enabled
        let ok = false;
        for (let brushTag of this.props.brushTags) {
            ok = ok || this.state.config.enabledBrushTags[brushTag];
        }
        if (!ok) {
            // Revert the change
            this.state.config.enabledBrushTags[brushTag] = true;
        }
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateManualOnly(manualOnly: boolean) {
        this.state.config.manualOnly = manualOnly;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateManualJitter(manualJitter: number) {
        let newValue = manualJitter;
        if (newValue < 0) {
            newValue = 0;
        }
        if (newValue > 4000) {
            newValue = 4000;
        }
        this.state.config.manualJitter = newValue;
        this.setState({
            config: this.state.config,
        });
    }

    renderControls() {
        return (<div id="stats">
            {/* TODO: bring back focus map */}
            {/* <ConfigItem
                label="Focus Exponent"
                onUpdate={this.onUpdateFocusExponentBase.bind(this)}
                value={this.state.config.focusExponent} /> */}
            <ConfigItem
                label="Frame Skip"
                onUpdate={this.onUpdateFrameSkip.bind(this)}
                value={this.state.config.frameSkip} />
            <ConfigItem
                label="Manual Painting Jitter"
                value={this.state.config.manualJitter}
                onUpdate={this.onUpdateManualJitter.bind(this)} />
            <ConfigCheckbox
                label="Manual Painting Only"
                value={this.state.config.manualOnly}
                onUpdate={this.onUpdateManualOnly.bind(this)} />
            {this.props.brushTags.map(brushTag => (
                <ConfigCheckbox
                    key={`brush_tag_${brushTag}`}
                    label={brushTag}
                    value={this.state.config.enabledBrushTags[brushTag]}
                    onUpdate={evt => this.onUpdateBrushEnabled(brushTag, evt.valueOf())} />
            ))}
            {/* We can bring back snapshots when we are able to save things on a server. */}
            {/* <ConfigCheckbox
                label="Enable Snapshots"
                value={this.state.config.saveSnapshots}
                onUpdate={this.onUpdateSaveSnapshots.bind(this)} />
            <ConfigItem
                label="Max Snapshots"
                value={this.state.config.maxSnapshots}
                increment={10}
                skipIncrement={100}
                onUpdate={this.onUpdateMaxSnapshots.bind(this)} /> */}
        </div>);
    }

    render() {
        return <div className={this.props.zoom ? "col-sm-3" : "col-sm-6"} id="stats-container">
            <h4>Stats</h4>
            FPS:
                <span id="fps">{this.props.fps}</span>
            <br /> IPS:
                <span id="ips">{this.props.ips}</span>
            <br /> Brush Strokes:
                <span id="triangles">{this.props.triangleCount}</span>
            <br /> Progress Speed:
                <span id="triangles">{this.props.progressSpeed}</span>
            <br /> Similarity:
                <div className="progress">
                <div id="similarity" className="progress-bar" role="progressbar" style={{ width: this.props.similarityText }}>
                    {this.props.similarityText}
                </div>
            </div>
            <hr />
            <h4>Controls</h4>
            {this.renderControls()}
        </div>;
    }
}
